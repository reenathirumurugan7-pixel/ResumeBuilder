import templates from '../data/templates'
import { resolveConfig } from '../config/customize'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Tab,
  HeadingLevel,
  AlignmentType,
  ImageRun,
  ExternalHyperlink,
  BorderStyle,
  UnderlineType,
  LineRuleType,
  TabStopType,
  Table,
  TableRow,
  TableCell,
  TableLayoutType,
  TableBorders,
  VerticalAlign,
  WidthType,
  ShadingType,
} from 'docx'

// A4 in twips (1/20 pt): 210 mm x 297 mm, spelled out so the export never
// depends on the library default.
const PAGE_WIDTH_TWIPS = 11906
const PAGE_HEIGHT_TWIPS = 16838

// The preview is authored in CSS px at 96 dpi, where 1 px = 15 twips.
const PX_TO_TWIPS = 15

// The preview insets the page by spacing.margin + spacing.padding (60 px by
// default), so the DOCX margins mirror both values. Clamping keeps the
// configured intent while guaranteeing the page stays printable and never
// grows past Word's own 1in default.
const MIN_MARGIN_TWIPS = 720
const MAX_MARGIN_TWIPS = 1440

// Word expresses line spacing as `w:line` in 240ths of a line when
// `w:lineRule="auto"`, so 1.5x is 360 — the preview's `line-height: 1.5`.
const LINE_SPACING_1_5 = 240 * 1.5

// The preview's dot markers are a 7px disc plus an 8px gap: 15 px. A hanging
// indent of ~200 twips keeps wrapped lines aligned under the text rather than
// under the marker.
const DOT_INDENT_TWIPS = 200

const DEFAULT_MARGIN_PX = 32
const DEFAULT_PADDING_PX = 28

// Photo sizing mirrors PhotoBlock in LiveResumePreview: an 80px base times
// config.photoScale clamped to 0.6-1.4 (48px-112px photo), plus the preview's
// 3px padding and 2px accent border, which are baked into the emitted PNG.
const PHOTO_BASE_PX = 80
const PHOTO_MIN_SCALE = 0.6
const PHOTO_MAX_SCALE = 1.4
const PHOTO_FRAME_PADDING_PX = 3
const PHOTO_FRAME_BORDER_PX = 2
const PHOTO_FRAME_RADIUS_PX = 10
const PHOTO_CORNER_RADIUS_PX = 8

// Nothing is attached to the document unless these bytes lead the payload.
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

const QR_BOX_PX = 96
const QR_RENDER_PX = 240

// The preview's two-column body is a `grid-template-columns: 3fr 2fr` grid
// with spacing.padding as the gutter (`.lrp-two-col`). Only these two sections
// move to the right column; everything else stays on the left.
const TWO_COLUMN_SECTION_KEYS = ['skills', 'languages']
const TWO_COLUMN_LEFT_SHARE = 3
const TWO_COLUMN_TOTAL_SHARE = 5

// The preview's sidebar layouts (`.lrp-sidebar-left` / `.lrp-sidebar-right`)
// split the grid into `32% 1fr` with spacing.padding as the visible gutter and
// paint the sidebar with colors.background at half that padding inset. Education
// and certifications live only in the sidebar: the preview duplicates them into
// the main column, but repeating resume content hurts readability, ATS parsing
// and document length, so DOCX renders each section exactly once.
const SIDEBAR_SECTION_KEYS = ['skills', 'languages', 'education', 'certifications']
const SIDEBAR_WIDTH_SHARE = 32
const SIDEBAR_WIDTH_TOTAL = 100

function normalizeConfig(configOrId) {
  if (configOrId && typeof configOrId === 'object') {
    return resolveConfig(configOrId)
  }
  if (configOrId) {
    const template = templates.find((t) => t.id === configOrId)
    if (template) return resolveConfig({ templateId: template.id })
  }
  return null
}

function toBytesDataUrl(dataUrl) {
  if (!dataUrl) return null
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/)
  if (!match) return null
  return {
    mimeType: match[1],
    base64: match[2],
  }
}

function bytesFromBase64(base64) {
  const byteString = atob(base64)
  const byteArray = new Uint8Array(byteString.length)
  for (let i = 0; i < byteString.length; i++) {
    byteArray[i] = byteString.charCodeAt(i)
  }
  return byteArray
}

function isPngBytes(bytes) {
  if (!bytes || bytes.length < PNG_SIGNATURE.length) return false
  return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)
}

// Adds a rounded rectangle to the current path without opening a new one, so
// callers decide whether it is stroked or used as a clip.
function roundedRectPath(ctx, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2))
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.arcTo(x + width, y, x + width, y + r, r)
  ctx.lineTo(x + width, y + height - r)
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r)
  ctx.lineTo(x + r, y + height)
  ctx.arcTo(x, y + height, x, y + height - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

// docx registers every embedded picture as a `.png` part, so JPEG bytes handed
// straight to ImageRun are declared as PNG and Word shows a broken image. The
// stored photo (photo.js re-encodes uploads to JPEG) is therefore decoded and
// re-encoded as a real PNG first: clipped to the configured shape, then framed
// with the preview's padding and accent border. The result is only returned
// once its own bytes start with the PNG signature, so a failed or
// mislabelled conversion resolves to null and the photo is omitted instead of
// failing the whole export.
async function photoAsPng(photo, options = {}) {
  const src = `data:${photo.mimeType};base64,${photo.base64}`
  let image
  try {
    image = await new Promise((resolve, reject) => {
      const node = new Image()
      node.onload = () => resolve(node)
      node.onerror = () => reject(new Error('photo decode failed'))
      node.src = src
    })
  } catch {
    return null
  }

  const naturalWidth = image.naturalWidth || image.width
  const naturalHeight = image.naturalHeight || image.height
  if (!naturalWidth || !naturalHeight) return null

  const scale = clamp(toPx(options.scale, 1), PHOTO_MIN_SCALE, PHOTO_MAX_SCALE)
  const photoSize = Math.max(1, Math.round(PHOTO_BASE_PX * scale))
  const outerSize = photoSize + (PHOTO_FRAME_PADDING_PX + PHOTO_FRAME_BORDER_PX) * 2
  const photoOffset = PHOTO_FRAME_BORDER_PX + PHOTO_FRAME_PADDING_PX

  const canvas = document.createElement('canvas')
  canvas.width = outerSize
  canvas.height = outerSize
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const frameColor = options.frameColor || null
  if (frameColor) {
    ctx.save()
    ctx.beginPath()
    roundedRectPath(
      ctx,
      PHOTO_FRAME_BORDER_PX / 2,
      PHOTO_FRAME_BORDER_PX / 2,
      outerSize - PHOTO_FRAME_BORDER_PX,
      outerSize - PHOTO_FRAME_BORDER_PX,
      PHOTO_FRAME_RADIUS_PX,
    )
    ctx.strokeStyle = `#${frameColor}`
    ctx.lineWidth = PHOTO_FRAME_BORDER_PX
    ctx.stroke()
    ctx.restore()
  }

  // Clip the picture first so a circle leaves the corners transparent and a
  // rounded square keeps the preview's 8px radius.
  ctx.save()
  ctx.beginPath()
  if (options.shape === 'circle') {
    ctx.arc(photoOffset + photoSize / 2, photoOffset + photoSize / 2, photoSize / 2, 0, Math.PI * 2)
  } else {
    roundedRectPath(ctx, photoOffset, photoOffset, photoSize, photoSize, PHOTO_CORNER_RADIUS_PX)
  }
  ctx.clip()

  // object-fit: cover — fill the square and crop the overflow, as the preview
  // does, so a circle never shows empty wedges.
  const cover = Math.max(photoSize / naturalWidth, photoSize / naturalHeight)
  const drawWidth = naturalWidth * cover
  const drawHeight = naturalHeight * cover
  ctx.drawImage(
    image,
    photoOffset + (photoSize - drawWidth) / 2,
    photoOffset + (photoSize - drawHeight) / 2,
    drawWidth,
    drawHeight,
  )
  ctx.restore()

  const png = canvas.toDataURL('image/png')
  if (typeof png !== 'string' || !png.startsWith('data:image/png;base64,')) return null

  let bytes
  try {
    bytes = bytesFromBase64(png.slice(png.indexOf(',') + 1))
  } catch {
    return null
  }
  if (!isPngBytes(bytes)) return null

  return { data: bytes, width: outerSize, height: outerSize }
}

function qrPngBytes(dataUrl) {
  if (typeof dataUrl !== 'string') return null
  const match = dataUrl.match(/^data:image\/png;base64,(.+)$/)
  if (!match) return null
  try {
    return bytesFromBase64(match[1])
  } catch {
    return null
  }
}

function toHalfPoints(px) {
  const value = Number(px)
  if (!Number.isFinite(value) || value <= 0) return 20
  return Math.max(14, Math.round(value * 1.5))
}

function toPx(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

// '#2563EB' / '2563EB' -> '2563EB'. Anything malformed returns null so the
// colour is simply left to Word instead of writing a broken value.
function colorCode(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  if (!/^#[0-9a-fA-F]{6}$/.test(withHash)) return null
  return withHash.slice(1).toUpperCase()
}

function fontName(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

// Only strings that are already complete addresses become links: a typed
// username or bare domain is never completed into a URL that was never
// entered.
function resolveLinkTarget(text) {
  const value = typeof text === 'string' ? text.trim() : ''
  if (!value) return null
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return `mailto:${value}`
  if (/^https?:\/\/\S+$/i.test(value)) return value
  if (/^www\.\S+\.\S+$/i.test(value)) return `https://${value}`
  return null
}

function linkOrText(ctx, text, size, color, font) {
  const target = resolveLinkTarget(text)
  const run = { text, size, color, font }
  if (!target) return new TextRun(run)
  return new ExternalHyperlink({
    children: [new TextRun({ ...run, underline: { type: UnderlineType.SINGLE } })],
    link: target,
  })
}

// The preview mirrors the header text with `text-align`, and the banner/card/
// minimal wrappers are not reproduced in DOCX — their inner content is left
// aligned in the preview too, so they share the left branch here.
function headerAlignment(headerStyle) {
  if (headerStyle === 'left' || headerStyle === 'banner' || headerStyle === 'card' || headerStyle === 'minimal') {
    return AlignmentType.LEFT
  }
  if (headerStyle === 'right') return AlignmentType.RIGHT
  return AlignmentType.CENTER
}

// Everything every paragraph builder needs, resolved once from the resume
// config so colours and fonts stay consistent across the document.
function buildContext(config) {
  const colors = config.colors || {}
  const fonts = config.fonts || {}
  const spacing = config.spacing || {}

  const lineGap = clamp((Number(spacing.line) || 0) * PX_TO_TWIPS, 40, 240)
  const sectionGap = clamp((Number(spacing.section) || 0) * PX_TO_TWIPS, 120, 480)
  const marginTwips = clamp(
    Math.round(
      (toPx(spacing.margin, DEFAULT_MARGIN_PX) + toPx(spacing.padding, DEFAULT_PADDING_PX)) * PX_TO_TWIPS,
    ),
    MIN_MARGIN_TWIPS,
    MAX_MARGIN_TWIPS,
  )

  const configuredSize = Number(fonts.size)
  const namePx = Number.isFinite(configuredSize) && configuredSize > 0 ? configuredSize + 8 : 22

  return {
    primary: colorCode(colors.primary),
    secondary: colorCode(colors.secondary),
    accent: colorCode(colors.accent),
    text: colorCode(colors.text),
    background: colorCode(colors.background),
    bodyFont: fontName(fonts.body),
    headingFont: fontName(fonts.heading),
    // Sizes mirror the preview's explicit px values, converted to Word's
    // half-point units: body 12px, entry title 12.5px, entry meta 11.5px,
    // contact/links/skills 11px, section heading 15px.
    bodySize: toHalfPoints(12),
    entryTitleSize: toHalfPoints(12.5),
    entryMetaSize: toHalfPoints(11.5),
    smallSize: toHalfPoints(11),
    headingSize: toHalfPoints(15),
    nameSize: toHalfPoints(namePx),
    captionSize: Math.max(14, toHalfPoints(12) - 2),
    lineGap,
    headingGap: clamp(lineGap * 2, 60, 240),
    sectionGap,
    marginTwips,
    headerTwips: Math.round(marginTwips / 2),
    footerTwips: Math.round(marginTwips / 2),
    contentWidth: PAGE_WIDTH_TWIPS - marginTwips * 2,
    // The rule under every section heading reproduces the preview's accent
    // line; it falls back to primary and disappears if neither is usable.
    ruleColor: colorCode(colors.accent) || colorCode(colors.primary),
  }
}

// 1.5 line-height plus the preview's spacing.line bottom margin, applied to
// body and detail paragraphs only.
function bodySpacing(ctx) {
  return { after: ctx.lineGap, line: LINE_SPACING_1_5, lineRule: LineRuleType.AUTO }
}

function renderSectionHeading(ctx, title) {
  const rule = ctx.ruleColor
    ? {
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 8, space: 4, color: ctx.ruleColor },
        },
      }
    : {}

  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      keepNext: true,
      keepLines: true,
      spacing: { before: ctx.sectionGap, after: ctx.headingGap },
      ...rule,
      children: [
        new TextRun({
          text: String(title).toUpperCase(),
          bold: true,
          size: ctx.headingSize,
          font: ctx.headingFont,
          color: ctx.primary,
        }),
      ],
    }),
  ]
}

function renderPlainText(ctx, text, size = ctx.bodySize) {
  if (!text) return []
  return [
    new Paragraph({
      spacing: bodySpacing(ctx),
      children: [new TextRun({ text, size, font: ctx.bodyFont, color: ctx.text })],
    }),
  ]
}

// Dates, company/school lines and other subtitles carry the secondary colour.
function renderSubtitle(ctx, text, size = ctx.bodySize) {
  if (!text) return []
  return [
    new Paragraph({
      spacing: bodySpacing(ctx),
      children: [new TextRun({ text, size, font: ctx.bodyFont, color: ctx.secondary })],
    }),
  ]
}

// Languages, certifications and achievements are plain paragraphs with a
// leading marker run instead of Word's bullet numbering, so the indent comes
// from a hanging indent rather than a list definition.
function renderDotLine(ctx, text, size = ctx.bodySize) {
  if (!text) return []
  return [
    new Paragraph({
      spacing: bodySpacing(ctx),
      indent: { left: DOT_INDENT_TWIPS, hanging: DOT_INDENT_TWIPS },
      children: [
        new TextRun({ text: '•  ', size, font: ctx.bodyFont, color: ctx.primary }),
        new TextRun({ text, size, font: ctx.bodyFont, color: ctx.text }),
      ],
    }),
  ]
}

// The bold line that opens each entry, with the dates pinned to the right
// margin by a right-aligned tab stop. keepNext/keepLines keep the title with
// the details underneath it instead of stranding it at the foot of a page.
function renderEntryHeading(ctx, title, meta) {
  const options = {
    keepNext: true,
    keepLines: true,
    spacing: { before: ctx.lineGap, after: Math.round(ctx.lineGap / 2), line: LINE_SPACING_1_5, lineRule: LineRuleType.AUTO },
    children: [new TextRun({ text: title, bold: true, size: ctx.entryTitleSize, font: ctx.headingFont, color: ctx.text })],
  }

  if (meta) {
    options.tabStops = [{ type: TabStopType.RIGHT, position: ctx.contentWidth }]
    options.children.push(
      new TextRun({ children: [new Tab()], size: ctx.entryMetaSize, font: ctx.headingFont, color: ctx.secondary }),
      new TextRun({ text: meta, size: ctx.entryMetaSize, font: ctx.headingFont, color: ctx.secondary }),
    )
  }

  return [new Paragraph(options)]
}

function renderSkillLine(ctx, skills) {
  const runs = []
  skills.forEach((skill, index) => {
    if (index > 0) {
      runs.push(new TextRun({ text: '  •  ', size: ctx.smallSize, font: ctx.bodyFont, color: ctx.accent }))
    }
    runs.push(new TextRun({ text: skill, size: ctx.smallSize, font: ctx.bodyFont, color: ctx.primary }))
  })
  if (runs.length === 0) return []
  return [new Paragraph({ spacing: bodySpacing(ctx), children: runs })]
}

function renderLinkedLine(ctx, parts, size, alignment) {
  const runs = []
  parts.forEach((part, index) => {
    if (index > 0) runs.push(new TextRun({ text: ' | ', size, font: ctx.bodyFont, color: ctx.secondary }))
    runs.push(linkOrText(ctx, part, size, ctx.secondary, ctx.bodyFont))
  })
  if (runs.length === 0) return []
  return [new Paragraph({ alignment, spacing: bodySpacing(ctx), children: runs })]
}

// Optional QR block. It only renders when the caller both opts in and names a
// stored resume, so unsaved drafts never emit a dead public link.
async function renderQrCode(ctx, options) {
  if (!options || !options.qrCodeEnabled) return []
  const resumeId = typeof options.resumeId === 'string' ? options.resumeId.trim() : ''
  if (!resumeId) return []

  try {
    const [{ qrDataUrl }, { resumeQrUrl, resumeUrl }] = await Promise.all([
      import('./qrImage'),
      import('./resumeStorage'),
    ])
    const data = qrPngBytes(qrDataUrl(resumeQrUrl(resumeId), QR_RENDER_PX))
    if (!data) return []

    return [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        keepNext: true,
        spacing: { before: ctx.sectionGap, after: 60 },
        children: [new ImageRun({ data, transformation: { width: QR_BOX_PX, height: QR_BOX_PX } })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        keepNext: true,
        spacing: { after: 40 },
        children: [
          new TextRun({ text: 'Scan to view this resume', size: ctx.captionSize, font: ctx.bodyFont, color: ctx.secondary }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 0 },
        children: [linkOrText(ctx, resumeUrl(resumeId), ctx.captionSize, ctx.accent, ctx.bodyFont)],
      }),
    ]
  } catch {
    // The QR code is an optional extra: never fail the export over it.
    return []
  }
}

// Shared by the header and the sidebar column: converts the stored photo to a
// genuine PNG (Phase 3) and wraps it in its own paragraph, or resolves to null
// when the photo is absent or cannot be converted so the rest of the document
// still exports.
async function renderPhotoParagraph(ctx, config, formData, alignment) {
  const pi = formData.personalInfo || {}
  const photoData = toBytesDataUrl(config.photo || pi.photo)
  if (!photoData) return null

  const png = await photoAsPng(photoData, {
    shape: config.photoShape,
    scale: config.photoScale,
    frameColor: ctx.accent || ctx.primary,
  }).catch(() => null)
  if (!png) return null

  try {
    return new Paragraph({
      alignment,
      keepNext: true,
      spacing: { after: ctx.lineGap },
      children: [
        new ImageRun({
          data: png.data,
          transformation: { width: png.width, height: png.height },
        }),
      ],
    })
  } catch {
    // Omit the photo rather than lose the document.
    return null
  }
}

// Photo, name and contact line, each following the configured header
// alignment. All contact and link items share one paragraph, matching the
// preview's single wrapping contact row. Sidebar layouts pass
// `includePhoto = false` because the photo lives in the sidebar column and
// must not be emitted twice.
async function renderHeader(ctx, config, formData, includePhoto = true) {
  const pi = formData.personalInfo || {}
  const alignment = headerAlignment(config.headerStyle)
  const children = []

  if (includePhoto) {
    const photoParagraph = await renderPhotoParagraph(ctx, config, formData, alignment)
    if (photoParagraph) children.push(photoParagraph)
  }

  children.push(
    new Paragraph({
      alignment,
      keepNext: true,
      keepLines: true,
      spacing: { after: Math.round(ctx.lineGap / 2) },
      children: [
        new TextRun({
          text: pi.fullName || 'Your Name',
          bold: true,
          size: ctx.nameSize,
          font: ctx.headingFont,
          color: ctx.primary,
        }),
      ],
    }),
  )

  const contactParts = [pi.email, pi.phone, pi.location, pi.linkedin, pi.github, pi.portfolio].filter(Boolean)
  children.push(...renderLinkedLine(ctx, contactParts, ctx.smallSize, alignment))

  return children
}

function renderSummarySection(ctx, formData, resumeType) {
  const experienced = resumeType === 'experienced'
  const text = experienced ? formData.professionalSummary : formData.careerObjective
  if (!text) return []
  return [
    ...renderSectionHeading(ctx, experienced ? 'Professional Summary' : 'Career Objective'),
    ...renderPlainText(ctx, text),
  ]
}

function renderEducationSection(ctx, formData) {
  const list = formData.education || []
  if (!list.length) return []

  const children = renderSectionHeading(ctx, 'Education')
  list.forEach((edu) => {
    const degree = [edu.degree, edu.department].filter(Boolean).join(' in ')
    const years = [edu.startYear, edu.endYear].filter(Boolean).join(' - ')
    const school = [edu.college, edu.university].filter(Boolean).join(', ')
    children.push(...renderEntryHeading(ctx, degree || 'Degree', years))
    children.push(...renderSubtitle(ctx, school))
    if (edu.cgpa) {
      const cgpaLabel = String(edu.cgpa).trim().endsWith('%') ? 'Percentage' : 'CGPA'
      children.push(...renderSubtitle(ctx, `${cgpaLabel}: ${edu.cgpa}`))
    }
  })
  return children
}

function renderSkillsSection(ctx, formData) {
  const list = formData.skills || []
  if (!list.length) return []
  return [...renderSectionHeading(ctx, 'Skills'), ...renderSkillLine(ctx, list)]
}

function renderLanguagesSection(ctx, formData) {
  const list = (formData.languages || [])
    .map((lang) => (typeof lang === 'string' ? { name: lang, proficiency: '' } : lang || {}))
    .filter((lang) => lang.name && String(lang.name).trim())
  if (!list.length) return []

  const children = renderSectionHeading(ctx, 'Languages')
  list.forEach((lang) => {
    const label = lang.proficiency ? `${lang.name}  \u00B7  ${lang.proficiency}` : String(lang.name)
    children.push(...renderDotLine(ctx, label))
  })
  return children
}

function renderProjectsSection(ctx, formData) {
  const list = formData.projects || []
  if (!list.length) return []

  const children = renderSectionHeading(ctx, 'Projects')
  list.forEach((proj) => {
    children.push(...renderEntryHeading(ctx, proj.title || 'Project', proj.technologies))
    children.push(...renderPlainText(ctx, proj.description))
    if (proj.link) {
      children.push(
        new Paragraph({
          spacing: bodySpacing(ctx),
          children: [linkOrText(ctx, proj.link, ctx.smallSize, ctx.accent, ctx.bodyFont)],
        }),
      )
    }
  })
  return children
}

function renderExperienceSection(ctx, formData, resumeType) {
  const list = resumeType === 'experienced' ? formData.workExperience || [] : []
  if (!list.length) return []

  const children = renderSectionHeading(ctx, 'Work Experience')
  list.forEach((exp) => {
    const dates = [exp.startDate, exp.endDate].filter(Boolean).join(' - ')
    const company = exp.company ? [exp.company, exp.location].filter(Boolean).join(', ') : ''
    children.push(...renderEntryHeading(ctx, exp.jobTitle || 'Job Title', dates))
    children.push(...renderSubtitle(ctx, company))
    children.push(...renderPlainText(ctx, exp.responsibilities))
  })
  return children
}

function renderInternshipSection(ctx, formData, resumeType) {
  const list = resumeType === 'fresher' ? formData.internship || [] : []
  if (!list.length) return []

  const children = renderSectionHeading(ctx, 'Internship')
  list.forEach((intern) => {
    children.push(...renderEntryHeading(ctx, intern.role || 'Role', intern.duration))
    children.push(...renderSubtitle(ctx, intern.company))
    children.push(...renderPlainText(ctx, intern.description))
  })
  return children
}

function renderCertificationsSection(ctx, formData) {
  const list = (formData.certifications || []).filter((cert) => cert && cert.name)
  if (!list.length) return []

  const children = renderSectionHeading(ctx, 'Certifications')
  list.forEach((cert) => children.push(...renderDotLine(ctx, cert.name)))
  return children
}

function renderAchievementsSection(ctx, formData) {
  const list = (formData.achievements || []).filter((achievement) => achievement && achievement.name)
  if (!list.length) return []

  const children = renderSectionHeading(ctx, 'Achievements')
  list.forEach((achievement) => children.push(...renderDotLine(ctx, achievement.name)))
  return children
}

function renderSection(ctx, key, formData, resumeType) {
  switch (key) {
    case 'summary':
      return renderSummarySection(ctx, formData, resumeType)
    case 'education':
      return renderEducationSection(ctx, formData)
    case 'skills':
      return renderSkillsSection(ctx, formData)
    case 'languages':
      return renderLanguagesSection(ctx, formData)
    case 'projects':
      return renderProjectsSection(ctx, formData)
    case 'experience':
      return renderExperienceSection(ctx, formData, resumeType)
    case 'internship':
      return renderInternshipSection(ctx, formData, resumeType)
    case 'certifications':
      return renderCertificationsSection(ctx, formData)
    case 'achievements':
      return renderAchievementsSection(ctx, formData)
    default:
      return []
  }
}

// Sections render in the configured order — the same ordered list the preview
// walks — with hidden sections removed.
function visibleSectionKeys(config) {
  const hidden = config.hiddenSections || []
  return (config.sections || []).filter((key) => !hidden.includes(key))
}

function renderOrderedSections(ctx, keys, formData, resumeType) {
  const children = []
  keys.forEach((key) => {
    children.push(...renderSection(ctx, key, formData, resumeType))
  })
  return children
}

function renderSections(ctx, config, formData, resumeType) {
  return renderOrderedSections(ctx, visibleSectionKeys(config), formData, resumeType)
}

// Column sizing for layout === "two". The gutter is spacing.padding converted
// to twips (1 CSS px = 15 twips) and is carved out of the two table columns
// rather than out of the page margin, so left + right + gap always sums to the
// content width that A4 and the current margins already produce.
function twoColumnMetrics(ctx, spacing) {
  const contentWidth = Math.max(2, ctx.contentWidth)
  const gap = clamp(
    Math.round(toPx(spacing.padding, DEFAULT_PADDING_PX) * PX_TO_TWIPS),
    0,
    Math.floor(contentWidth / 3),
  )
  const available = Math.max(2, contentWidth - gap)
  const leftText = Math.max(1, Math.round((available * TWO_COLUMN_LEFT_SHARE) / TWO_COLUMN_TOTAL_SHARE))
  const rightText = Math.max(1, available - leftText)
  const gapLeft = Math.ceil(gap / 2)
  const gapRight = gap - gapLeft

  return {
    gap,
    gapLeft,
    gapRight,
    leftText,
    rightText,
    // The grid columns carry the gutter split as cell padding: the left cell's
    // right margin plus the right cell's left margin is exactly `gap`.
    leftColumnWidth: leftText + gapLeft,
    rightColumnWidth: rightText + gapRight,
  }
}

// One borderless fixed-layout table with a single row holding both columns.
// The row deliberately omits cantSplit so Word may continue it on the next
// page instead of pushing a whole page blank, and the header/QR stay outside
// the table entirely.
function renderTwoColumnBody(ctx, config, formData, resumeType) {
  const ordered = visibleSectionKeys(config)
  const leftKeys = ordered.filter((key) => !TWO_COLUMN_SECTION_KEYS.includes(key))
  const rightKeys = ordered.filter((key) => TWO_COLUMN_SECTION_KEYS.includes(key))
  const widths = twoColumnMetrics(ctx, config.spacing || {})

  const leftCtx = { ...ctx, contentWidth: widths.leftText }
  const rightCtx = { ...ctx, contentWidth: widths.rightText }

  // Explicit zero insets on every side: Word otherwise applies its default
  // 108-twip left/right cell margin, which would double the page margin and
  // shrink the gutter.
  const noInsets = { marginUnitType: WidthType.DXA, top: 0, bottom: 0, left: 0, right: 0 }

  const leftCell = new TableCell({
    width: { type: WidthType.DXA, size: widths.leftColumnWidth },
    margins: { ...noInsets, right: widths.gapLeft },
    verticalAlign: VerticalAlign.TOP,
    children: renderOrderedSections(leftCtx, leftKeys, formData, resumeType),
  })

  const rightCell = new TableCell({
    width: { type: WidthType.DXA, size: widths.rightColumnWidth },
    margins: { ...noInsets, left: widths.gapRight },
    verticalAlign: VerticalAlign.TOP,
    children: renderOrderedSections(rightCtx, rightKeys, formData, resumeType),
  })

  return [
    new Table({
      width: { type: WidthType.DXA, size: ctx.contentWidth },
      columnWidths: [widths.leftColumnWidth, widths.rightColumnWidth],
      layout: TableLayoutType.FIXED,
      borders: TableBorders.NONE,
      margins: noInsets,
      rows: [new TableRow({ children: [leftCell, rightCell] })],
    }),
  ]
}

// Column sizing for layout === "sidebar-left" / "sidebar-right". The preview's
// grid is `32% 1fr` with spacing.padding as the visible gutter, so the sidebar
// cell takes 32% of the content width, the main cell takes the rest, and the
// whole gutter lives in the main cell's inset on the side that faces the
// sidebar — never in the page margin. The sidebar keeps the preview's
// `padding: spacing.padding / 2` on all four sides, which is what carries
// colors.background in from the cell edge.
function sidebarMetrics(ctx, spacing) {
  const contentWidth = Math.max(2, ctx.contentWidth)
  const gap = clamp(
    Math.round(toPx(spacing.padding, DEFAULT_PADDING_PX) * PX_TO_TWIPS),
    0,
    Math.floor(contentWidth / 4),
  )
  const sidebarColumnWidth = clamp(
    Math.round((contentWidth * SIDEBAR_WIDTH_SHARE) / SIDEBAR_WIDTH_TOTAL),
    1,
    contentWidth - 1,
  )
  const mainColumnWidth = contentWidth - sidebarColumnWidth
  // Half the gutter as the sidebar's inner padding, capped so the column never
  // fills up with padding and drops its content.
  const pad = Math.min(Math.ceil(gap / 2), Math.floor(sidebarColumnWidth / 4))
  const mainInset = Math.min(gap, Math.max(0, mainColumnWidth - 1))

  return {
    gap,
    pad,
    sidebarColumnWidth,
    mainColumnWidth,
    sidebarTextWidth: Math.max(1, sidebarColumnWidth - pad * 2),
    mainTextWidth: Math.max(1, mainColumnWidth - mainInset),
  }
}

// Each region keeps the relative order of config.sections; only the membership
// differs. Education and certifications belong to the sidebar alone, so they
// are filtered out of the main list instead of being rendered twice.
function sidebarSectionKeys(config) {
  return visibleSectionKeys(config).filter((key) => SIDEBAR_SECTION_KEYS.includes(key))
}

function sidebarMainKeys(config) {
  return visibleSectionKeys(config).filter((key) => !SIDEBAR_SECTION_KEYS.includes(key))
}

// One borderless fixed-layout table holding the sidebar and the main column.
// The row omits cantSplit so Word may continue it on the next page, and the
// header/QR stay outside the table entirely. Photo, skills, languages,
// education and certifications go in the sidebar; summary, experience,
// projects, internship and achievements go in the main column.
async function renderSidebarBody(ctx, config, formData, resumeType, side) {
  const widths = sidebarMetrics(ctx, config.spacing || {})
  const noInsets = { marginUnitType: WidthType.DXA, top: 0, bottom: 0, left: 0, right: 0 }

  const sidebarCtx = { ...ctx, contentWidth: widths.sidebarTextWidth }
  const mainCtx = { ...ctx, contentWidth: widths.mainTextWidth }

  const sidebarChildren = []
  const photo = await renderPhotoParagraph(sidebarCtx, config, formData, AlignmentType.LEFT)
  if (photo) sidebarChildren.push(photo)
  sidebarChildren.push(...renderOrderedSections(sidebarCtx, sidebarSectionKeys(config), formData, resumeType))

  const mainChildren = renderOrderedSections(mainCtx, sidebarMainKeys(config), formData, resumeType)

  const sidebarCell = new TableCell({
    width: { type: WidthType.DXA, size: widths.sidebarColumnWidth },
    margins: {
      ...noInsets,
      top: widths.pad,
      bottom: widths.pad,
      left: widths.pad,
      right: widths.pad,
    },
    verticalAlign: VerticalAlign.TOP,
    // Only the sidebar is painted; the main cell keeps the document background.
    shading: ctx.background
      ? { type: ShadingType.SOLID, color: ctx.background, fill: ctx.background }
      : undefined,
    children: sidebarChildren,
  })

  const mainCell = new TableCell({
    width: { type: WidthType.DXA, size: widths.mainColumnWidth },
    margins:
      side === 'left' ? { ...noInsets, left: widths.gap } : { ...noInsets, right: widths.gap },
    verticalAlign: VerticalAlign.TOP,
    children: mainChildren,
  })

  const cells = side === 'left' ? [sidebarCell, mainCell] : [mainCell, sidebarCell]
  const columnWidths =
    side === 'left'
      ? [widths.sidebarColumnWidth, widths.mainColumnWidth]
      : [widths.mainColumnWidth, widths.sidebarColumnWidth]

  return [
    new Table({
      width: { type: WidthType.DXA, size: ctx.contentWidth },
      columnWidths,
      layout: TableLayoutType.FIXED,
      borders: TableBorders.NONE,
      margins: noInsets,
      rows: [new TableRow({ children: cells })],
    }),
  ]
}

// Layout dispatcher. Only `two` and the sidebar pair change shape; every other
// layout keeps the flat body. A table that cannot be built degrades to that
// same flat body so the export never emits a corrupt package, and the failure
// is logged. `fallback` reports that the sidebar column was abandoned, so
// generateWord can put the photo back into the header instead of losing it.
async function renderBody(ctx, config, formData, resumeType) {
  const layout = config.layout

  if (layout === 'sidebar-left' || layout === 'sidebar-right') {
    try {
      const children = await renderSidebarBody(
        ctx,
        config,
        formData,
        resumeType,
        layout === 'sidebar-left' ? 'left' : 'right',
      )
      return { children, fallback: false }
    } catch (error) {
      console.error('[wordExport] sidebar body failed; falling back to the flat single column.', error)
      return { children: renderSections(ctx, config, formData, resumeType), fallback: true }
    }
  }

  if (layout === 'two') {
    try {
      return { children: renderTwoColumnBody(ctx, config, formData, resumeType), fallback: false }
    } catch (error) {
      console.error('[wordExport] two-column body failed; falling back to the flat single column.', error)
      return { children: renderSections(ctx, config, formData, resumeType), fallback: true }
    }
  }

  return { children: renderSections(ctx, config, formData, resumeType), fallback: false }
}

export async function generateWord(formData, resumeType, configOrId = null, options = {}) {
  const pi = formData.personalInfo || {}
  const config = normalizeConfig(configOrId) || resolveConfig({ templateId: 'modern-blue' })
  const ctx = buildContext(config)

  const body = await renderBody(ctx, config, formData, resumeType)
  const sidebarLayout = config.layout === 'sidebar-left' || config.layout === 'sidebar-right'

  const children = [
    ...(await renderHeader(ctx, config, formData, !sidebarLayout || body.fallback)),
    ...body.children,
    ...(await renderQrCode(ctx, options)),
  ]

  const styles = {
    default: {
      document: {
        run: { font: ctx.bodyFont, color: ctx.text, size: ctx.bodySize },
        paragraph: { spacing: { after: ctx.lineGap } },
      },
      heading2: {
        run: { font: ctx.headingFont, color: ctx.primary, size: ctx.headingSize, bold: true },
        paragraph: {
          keepNext: true,
          keepLines: true,
          spacing: { before: ctx.sectionGap, after: ctx.headingGap },
        },
      },
      hyperlink: {
        run: { font: ctx.bodyFont, color: ctx.accent, underline: { type: UnderlineType.SINGLE } },
      },
    },
  }

  const doc = new Document({
    background: ctx.background ? { color: ctx.background } : undefined,
    styles,
    sections: [
      {
        properties: {
          page: {
            size: {
              width: PAGE_WIDTH_TWIPS,
              height: PAGE_HEIGHT_TWIPS,
              orientation: 'portrait',
            },
            margin: {
              top: ctx.marginTwips,
              right: ctx.marginTwips,
              bottom: ctx.marginTwips,
              left: ctx.marginTwips,
              header: ctx.headerTwips,
              footer: ctx.footerTwips,
              gutter: 0,
            },
          },
        },
        children,
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  const safeName = (pi.fullName || 'resume')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 60) || 'resume'
  const fileName = `${safeName}_Resume.docx`
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  // Resolved once the browser has been handed the file, so callers can confirm
  // the download happened before they count it.
  return fileName
}
