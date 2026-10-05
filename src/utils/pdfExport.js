import { jsPDF } from 'jspdf'
import templates from '../data/templates'
import { resolveConfig } from '../config/customize'
import { qrDataUrl } from './qrImage'
import { resumeQrUrl } from './resumeStorage'
import { detectImageFormat } from './photo'

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex))
  return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [26, 86, 219]
}

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

function mapFont(family, style) {
  const f = (family || '').toLowerCase()
  if (['times new roman', 'georgia', 'merriweather'].includes(f)) {
    return ['times', style]
  }
  if (f === 'courier') {
    return ['courier', style]
  }
  return ['helvetica', style]
}

function drawHeader(doc, config, pi, y, rightPad = 0) {
  const headerStyle = config.headerStyle || 'center'
  const colors = config.colors
  const nameRgb = hexToRgb(colors.primary)
  const subRgb = hexToRgb(colors.secondary)
  const rightLimit = 190 - rightPad

  const contactParts = [pi.email, pi.phone, pi.location].filter(Boolean)
  const linkParts = [pi.linkedin, pi.github, pi.portfolio].filter(Boolean)

  if (config.photo) {
    const w = 18
    const h = 18
    let px = 20
    if (headerStyle === 'center') px = 105 - w / 2
    else if (headerStyle === 'right') px = rightLimit - w
    try {
      // Hard-coding 'JPEG' made PNG photos throw and disappear from the header.
      doc.addImage(config.photo, detectImageFormat(config.photo), px, y, w, h)
    } catch {
      /* photo data may be unsupported by jsPDF; ignore */
    }
    y += h + 4
  }

  const [nameFont, nameStyle] = mapFont(config.fonts.heading, 'bold')
  doc.setFontSize(config.fonts.size + 6)
  doc.setFont(nameFont, nameStyle)
  doc.setTextColor(nameRgb[0], nameRgb[1], nameRgb[2])

  const align = headerStyle === 'left' ? 'left' : headerStyle === 'right' ? 'right' : 'center'
  const x = headerStyle === 'left' ? 20 : headerStyle === 'right' ? rightLimit : (20 + rightLimit) / 2

  doc.text(pi.fullName || 'Your Name', x, y, { align })
  y += 7

  doc.setFont(mapFont(config.fonts.body, 'normal')[0], 'normal')
  doc.setFontSize(9)
  doc.setTextColor(subRgb[0], subRgb[1], subRgb[2])
  if (contactParts.length > 0) {
    doc.text(contactParts.join('  |  '), x, y, { align })
    y += 5
  }
  if (linkParts.length > 0) {
    doc.text(linkParts.join('  |  '), x, y, { align })
    y += 5
  }

  if (headerStyle === 'banner') {
    const bannerH = 22
    doc.setFillColor(nameRgb[0], nameRgb[1], nameRgb[2])
    doc.roundedRect(12, y - bannerH + 2, rightLimit - 12, bannerH, 3, 3, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont(mapFont(config.fonts.heading, 'normal')[0], 'normal')
    doc.setFontSize(8.5)
    doc.text(contactParts.join('  |  '), (20 + rightLimit) / 2, y, { align: 'center' })
    y += bannerH - 6
  }

  const lineRgb = hexToRgb(colors.primary)
  doc.setDrawColor(lineRgb[0], lineRgb[1], lineRgb[2])
  doc.setLineWidth(0.8)
  doc.line(20, y, rightLimit, y)
  y += 8

  return y
}

const PAGE_HEIGHT = 277
const MARGIN_BOTTOM = 20

function ensurePage(doc, y, currentPageRef) {
  if (y > PAGE_HEIGHT - MARGIN_BOTTOM) {
    doc.addPage()
    currentPageRef.value = currentPageRef.value + 1
    return 20
  }
  return y
}

function addSectionTitle(doc, title, y, config, currentPageRef) {
  y = ensurePage(doc, y, currentPageRef)
  doc.setFontSize(11)
  doc.setFont(mapFont(config.fonts.heading, 'bold')[0], 'bold')
  const primary = hexToRgb(config.colors.primary)
  doc.setTextColor(primary[0], primary[1], primary[2])
  doc.text(title, 20, y)
  doc.setDrawColor(primary[0], primary[1], primary[2])
  doc.setLineWidth(0.5)
  doc.line(20, y + 2, 190, y + 2)
  return y + 8
}

function addWrappedText(doc, text, x, y, maxWidth, config, currentPageRef) {
  const lines = doc.splitTextToSize(text, maxWidth)
  doc.setFontSize(config.fonts.size - 2)
  const [font, style] = mapFont(config.fonts.body, 'normal')
  doc.setFont(font, style)
  const textRgb = hexToRgb(config.colors.text)
  doc.setTextColor(textRgb[0], textRgb[1], textRgb[2])
  lines.forEach((line) => {
    y = ensurePage(doc, y, currentPageRef)
    doc.text(line, x, y)
    y += 5
  })
  return y
}

export function generatePDF(formData, resumeType, configOrId = null, options = {}) {
  const doc = new jsPDF('p', 'mm', 'a4')
  const currentPageRef = { value: 1 }
  let y = 14

  const config = normalizeConfig(configOrId)
  const fallbackConfig = resolveConfig({ templateId: 'modern-blue' })
  const eff = config || fallbackConfig
  const textColor = hexToRgb(eff.colors.text)
  const secondary = hexToRgb(eff.colors.secondary)

  const pi = formData.personalInfo

  const qrSize = 24
  if (options.qrCodeEnabled && options.resumeId) {
    const url = resumeQrUrl(options.resumeId)
    const dataUrl = qrDataUrl(url, 200)
    if (dataUrl) {
      try {
        doc.addImage(dataUrl, 'PNG', 210 - 20 - qrSize, 12, qrSize, qrSize)
      } catch {
        /* QR image could not be embedded; skip */
      }
    }
  }

  const headerPad = options.qrCodeEnabled ? qrSize + 10 : 0
  y = drawHeader(doc, eff, pi, y, headerPad)

  const hidden = eff.hiddenSections || []
  const sections = (eff.sections || ['summary', 'education', 'skills', 'projects', 'experience', 'internship', 'certifications', 'achievements'])
    .filter((s) => !hidden.includes(s))

  const pushSection = (key, fn) => {
    if (!sections.includes(key)) return
    const has = fn()
    if (has) y += 4
  }

  const summary = resumeType === 'experienced' ? 'professionalSummary' : 'careerObjective'
  pushSection('summary', () => {
    if (formData[summary]) {
      y = addSectionTitle(doc, resumeType === 'experienced' ? 'Professional Summary' : 'Career Objective', y, eff, currentPageRef)
      y = addWrappedText(doc, formData[summary], 20, y, 170, eff, currentPageRef)
      return true
    }
    return false
  })

  pushSection('experience', () => {
    if (resumeType === 'experienced' && formData.workExperience?.length > 0) {
      y = addSectionTitle(doc, 'Work Experience', y, eff, currentPageRef)
      formData.workExperience.forEach((exp) => {
        y = ensurePage(doc, y, currentPageRef)
        doc.setFontSize(10.5)
        const [bf, bs] = mapFont(eff.fonts.heading, 'bold')
        doc.setFont(bf, bs)
        doc.setTextColor(textColor[0], textColor[1], textColor[2])
        doc.text(exp.jobTitle || 'Job Title', 20, y)
        const [nf, ns] = mapFont(eff.fonts.body, 'normal')
        doc.setFont(nf, ns)
        doc.setTextColor(secondary[0], secondary[1], secondary[2])
        const dateStr = [exp.startDate, exp.endDate].filter(Boolean).join(' - ')
        doc.text(dateStr, 190, y, { align: 'right' })
        y += 5
        if (exp.company) {
          y = ensurePage(doc, y, currentPageRef)
          doc.setTextColor(secondary[0], secondary[1], secondary[2])
          doc.text(exp.company + (exp.location ? `, ${exp.location}` : ''), 20, y)
          y += 5
        }
        if (exp.responsibilities) {
          y = addWrappedText(doc, exp.responsibilities, 20, y, 170, eff, currentPageRef)
        }
        y += 3
      })
      return true
    }
    return false
  })

  pushSection('education', () => {
    if (formData.education?.length > 0) {
      y = addSectionTitle(doc, 'Education', y, eff, currentPageRef)
      formData.education.forEach((edu) => {
        y = ensurePage(doc, y, currentPageRef)
        doc.setFontSize(10.5)
        const [bf, bs] = mapFont(eff.fonts.heading, 'bold')
        doc.setFont(bf, bs)
        doc.setTextColor(textColor[0], textColor[1], textColor[2])
        const degree = [edu.degree, edu.department].filter(Boolean).join(' in ')
        doc.text(degree || 'Degree', 20, y)
        const [nf, ns] = mapFont(eff.fonts.body, 'normal')
        doc.setFont(nf, ns)
        doc.setTextColor(secondary[0], secondary[1], secondary[2])
        const yearStr = [edu.startYear, edu.endYear].filter(Boolean).join(' - ')
        doc.text(yearStr, 190, y, { align: 'right' })
        y += 5
        if (edu.college || edu.university) {
          y = ensurePage(doc, y, currentPageRef)
          doc.setTextColor(secondary[0], secondary[1], secondary[2])
          const school = [edu.college, edu.university].filter(Boolean).join(', ')
          doc.text(school, 20, y)
          y += 5
        }
        if (edu.cgpa) {
          y = ensurePage(doc, y, currentPageRef)
          doc.setTextColor(secondary[0], secondary[1], secondary[2])
          const cgpaLabel = String(edu.cgpa).trim().endsWith('%') ? 'Percentage' : 'CGPA'
          doc.text(`${cgpaLabel}: ${edu.cgpa}`, 20, y)
          y += 5
        }
        y += 3
      })
      return true
    }
    return false
  })

  pushSection('skills', () => {
    if (formData.skills?.length > 0) {
      y = addSectionTitle(doc, 'Skills', y, eff, currentPageRef)
      const skillsText = formData.skills.join('  ·  ')
      y = addWrappedText(doc, skillsText, 20, y, 170, eff, currentPageRef)
      return true
    }
    return false
  })

  pushSection('languages', () => {
    const languages = (formData.languages || [])
      .map((lang) => (typeof lang === 'string' ? { name: lang, proficiency: '' } : lang || {}))
      .filter((lang) => lang.name && lang.name.trim())
    if (languages.length > 0) {
      y = addSectionTitle(doc, 'Languages', y, eff, currentPageRef)
      const [nf, ns] = mapFont(eff.fonts.body, 'normal')
      doc.setFont(nf, ns)
      doc.setFontSize(10)
      doc.setTextColor(textColor[0], textColor[1], textColor[2])
      languages.forEach((lang) => {
        y = ensurePage(doc, y, currentPageRef)
        const label = lang.proficiency ? `${lang.name}  ·  ${lang.proficiency}` : lang.name
        doc.text(`·  ${label}`, 20, y)
        y += 5
      })
      return true
    }
    return false
  })

  pushSection('projects', () => {
    if (formData.projects?.length > 0) {
      y = addSectionTitle(doc, 'Projects', y, eff, currentPageRef)
      formData.projects.forEach((proj) => {
        y = ensurePage(doc, y, currentPageRef)
        doc.setFontSize(10.5)
        const [bf, bs] = mapFont(eff.fonts.heading, 'bold')
        doc.setFont(bf, bs)
        doc.setTextColor(textColor[0], textColor[1], textColor[2])
        doc.text(proj.title || 'Project', 20, y)
        y += 5
        if (proj.technologies) {
          y = ensurePage(doc, y, currentPageRef)
          const [nf, ns] = mapFont(eff.fonts.body, 'italic')
          doc.setFont(nf, ns)
          doc.setTextColor(secondary[0], secondary[1], secondary[2])
          doc.text(`Technologies: ${proj.technologies}`, 20, y)
          y += 5
        }
        if (proj.description) {
          y = addWrappedText(doc, proj.description, 20, y, 170, eff, currentPageRef)
        }
        if (proj.link) {
          y = ensurePage(doc, y, currentPageRef)
          const accent = hexToRgb(eff.colors.accent)
          doc.setFont(mapFont(eff.fonts.body, 'normal')[0], 'normal')
          doc.setTextColor(accent[0], accent[1], accent[2])
          doc.text(proj.link, 20, y)
          y += 5
        }
        y += 3
      })
      return true
    }
    return false
  })

  pushSection('internship', () => {
    const internships = resumeType === 'fresher' ? formData.internship : null
    if (internships?.length > 0) {
      y = addSectionTitle(doc, 'Internship', y, eff, currentPageRef)
      internships.forEach((intern) => {
        y = ensurePage(doc, y, currentPageRef)
        doc.setFontSize(10.5)
        const [bf, bs] = mapFont(eff.fonts.heading, 'bold')
        doc.setFont(bf, bs)
        doc.setTextColor(textColor[0], textColor[1], textColor[2])
        doc.text(intern.role || 'Role', 20, y)
        const [nf, ns] = mapFont(eff.fonts.body, 'normal')
        doc.setFont(nf, ns)
        doc.setTextColor(secondary[0], secondary[1], secondary[2])
        if (intern.duration) doc.text(intern.duration, 190, y, { align: 'right' })
        y += 5
        if (intern.company) {
          y = ensurePage(doc, y, currentPageRef)
          doc.setTextColor(secondary[0], secondary[1], secondary[2])
          doc.text(intern.company, 20, y)
          y += 5
        }
        if (intern.description) {
          y = addWrappedText(doc, intern.description, 20, y, 170, eff, currentPageRef)
        }
        y += 3
      })
      return true
    }
    return false
  })

  pushSection('certifications', () => {
    if (formData.certifications?.length > 0) {
      y = addSectionTitle(doc, 'Certifications', y, eff, currentPageRef)
      const [nf, ns] = mapFont(eff.fonts.body, 'normal')
      doc.setFont(nf, ns)
      doc.setFontSize(10)
      doc.setTextColor(textColor[0], textColor[1], textColor[2])
      formData.certifications.forEach((cert) => {
        if (cert.name) {
          y = ensurePage(doc, y, currentPageRef)
          doc.text(`·  ${cert.name}`, 20, y)
          y += 5
        }
      })
      return true
    }
    return false
  })

  pushSection('achievements', () => {
    if (formData.achievements?.length > 0) {
      y = addSectionTitle(doc, 'Achievements', y, eff, currentPageRef)
      const [nf, ns] = mapFont(eff.fonts.body, 'normal')
      doc.setFont(nf, ns)
      doc.setFontSize(10)
      doc.setTextColor(textColor[0], textColor[1], textColor[2])
      formData.achievements.forEach((ach) => {
        if (ach.name) {
          y = ensurePage(doc, y, currentPageRef)
          doc.text(`·  ${ach.name}`, 20, y)
          y += 5
        }
      })
      return true
    }
    return false
  })

  const fileName = `${(pi.fullName || 'resume').replace(/\s+/g, '_')}_Resume.pdf`
  doc.save(fileName)
  return fileName
}
