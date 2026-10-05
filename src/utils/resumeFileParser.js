// Reads a resume file chosen in the "Import Resume" card of the Enhance Resume
// page and turns it into plain text.
//
// Supported formats:
//   - .json  ResumeBuilder's own export (raw file text, no third-party reader)
//   - .pdf   text-based PDFs, all pages, in page order
//   - .docx  Word documents, paragraph per line
//
// The old binary .doc format is deliberately NOT supported. Word 97-2003 files
// use a compound-binary container that neither of the readers below can open,
// so they are rejected up front with an explicit message instead of pretending
// to work. Plain text (.txt) is not supported either. Scanned PDFs (images only)
// are rejected too: no OCR is implemented.
//
// PDF pages are reported one by one, because a document can mix real text and
// scanned pages. Whatever could be read is always returned; which pages yielded
// nothing is reported alongside it, so a partial import can never be mistaken
// for a complete one.
//
// Nothing in this module reads or writes storage. It only ever turns a File the
// user picked into text plus warnings.

/** Human-readable format list shown on the import card. */
export const RESUME_IMPORT_FORMAT_LABEL = 'JSON, PDF, DOCX'

/** Value for the <input type="file" accept> attribute. */
export const RESUME_IMPORT_ACCEPT =
  '.json,application/json,.pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/** 10 MB. Well above any real resume, low enough to keep the tab responsive. */
export const MAX_RESUME_FILE_BYTES = 10 * 1024 * 1024

/** Hard cap on pages read from one PDF. Resumes are 1-3 pages in practice. */
const MAX_PDF_PAGES = 50

const PDF_EXTENSION = /\.pdf$/i
const DOCX_EXTENSION = /\.docx$/i
const JSON_EXTENSION = /\.json$/i
const LEGACY_DOC_EXTENSION = /\.doc$/i
const TEXT_EXTENSION = /\.txt$/i

const MIME_BY_KIND = {
  // text/plain is deliberately absent. JSON is the only plain-text format this
  // importer accepts, and mapping text/plain onto it let a .txt file pass
  // validation and then fail much later with "that file is not valid JSON".
  json: ['application/json', 'text/json'],
  pdf: ['application/pdf', 'application/x-pdf', 'application/octet-stream'],
  docx: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
    'application/octet-stream',
  ],
}

const UNSUPPORTED_MESSAGE =
  'That file type is not supported. Upload a ResumeBuilder JSON export, a text-based PDF, or a .docx Word file (JSON, PDF, DOCX).'

/** Error carrying a stable `code` so the UI can pick a message without parsing text. */
export class ResumeFileError extends Error {
  constructor(message, code = 'invalid-file') {
    super(message)
    this.name = 'ResumeFileError'
    this.code = code
  }
}

function extensionOf(file) {
  const name = typeof file?.name === 'string' ? file.name : ''
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot).toLowerCase()
}

function cleanMime(file) {
  const type = typeof file?.type === 'string' ? file.type : ''
  return type.split(';')[0].trim().toLowerCase()
}

/**
 * Type implied by the file name alone, or null when the name says nothing.
 * Split out from detectResumeFileType so the MIME cross-check in
 * validateResumeFile can tell "the name decided this" from "the MIME decided".
 */
function extensionTypeOf(file) {
  const ext = extensionOf(file)
  if (JSON_EXTENSION.test(ext)) return 'json'
  if (PDF_EXTENSION.test(ext)) return 'pdf'
  if (DOCX_EXTENSION.test(ext)) return 'docx'
  return null
}

/**
 * Best-effort file type detection from the name and the browser MIME type.
 * Returns 'json' | 'pdf' | 'docx' | null.
 */
export function detectResumeFileType(file) {
  if (!file) return null
  // Some browsers report an empty or generic MIME type for a correctly named
  // file, so a recognised extension stays authoritative.
  const byExtension = extensionTypeOf(file)
  if (byExtension) return byExtension
  const mime = cleanMime(file)
  if (MIME_BY_KIND.pdf.includes(mime)) return 'pdf'
  if (MIME_BY_KIND.docx.includes(mime) && !mime.includes('wordprocessingml.template')) return 'docx'
  if (MIME_BY_KIND.json.includes(mime)) return 'json'
  return null
}

function sizeLabel(bytes) {
  return `${Math.max(1, Math.round(bytes / (1024 * 1024)))} MB`
}

/**
 * Checks a File before any of it is read into memory.
 *
 * @returns {{ ok: boolean, type: string|null, message: string, code: string }}
 *   `code` is a stable machine-readable reason (empty when ok) so callers never
 *   have to match on the message text.
 */
export function validateResumeFile(file) {
  if (!file) {
    return { ok: false, type: null, message: 'No file was selected.', code: 'invalid-file' }
  }

  if (LEGACY_DOC_EXTENSION.test(extensionOf(file))) {
    return {
      ok: false,
      type: null,
      message:
        'Old .doc files are not supported. Open it in Word and use "Save As" to create a .docx file, then upload that.',
      code: 'unsupported-format',
    }
  }

  // Named explicitly so the message explains the real problem instead of
  // reporting a plain text file as an unknown type.
  if (TEXT_EXTENSION.test(extensionOf(file))) {
    return {
      ok: false,
      type: null,
      message:
        'Plain text (.txt) files are not supported. Upload a ResumeBuilder JSON export, a text-based PDF, or a .docx Word file (JSON, PDF, DOCX).',
      code: 'unsupported-format',
    }
  }

  const type = detectResumeFileType(file)
  if (!type) {
    return { ok: false, type: null, message: UNSUPPORTED_MESSAGE, code: 'unsupported-format' }
  }

  // A name that carries an extension we do not support is rejected outright,
  // even when the browser reports a generic MIME type. Windows sends
  // application/octet-stream for anything it does not recognise, so MIME alone
  // cannot tell `resume.pdf` from `virus.exe`, and `resume.exe` would otherwise
  // be accepted here as a PDF and only fail later, with a less useful message.
  // Files with no extension at all still fall through to the MIME check above.
  const extension = extensionOf(file)
  if (extension && !PDF_EXTENSION.test(extension) && !DOCX_EXTENSION.test(extension) && !JSON_EXTENSION.test(extension)) {
    return {
      ok: false,
      type: null,
      message: UNSUPPORTED_MESSAGE,
      code: 'unsupported-format',
    }
  }

  if (typeof file.size === 'number' && file.size > MAX_RESUME_FILE_BYTES) {
    return {
      ok: false,
      type: null,
      message: `That file is ${sizeLabel(file.size)}. Please upload a resume under ${sizeLabel(MAX_RESUME_FILE_BYTES)}.`,
      code: 'file-too-large',
    }
  }

  if (file.size === 0) {
    return {
      ok: false,
      type: null,
      message: 'That file is empty (0 bytes), so there is nothing to read.',
      code: 'invalid-file',
    }
  }

  // A MIME type that is present but clearly wrong is rejected before reading.
  const mime = cleanMime(file)
  // A JSON export is plain text by nature, and some file pickers report it as
  // text/plain rather than application/json. That combination is only tolerated
  // when the name already says .json, so a .txt or an unnamed file carrying
  // text/plain is still not treated as a resume export.
  const isTextPlainJson =
    type === 'json' && JSON_EXTENSION.test(extensionOf(file)) && mime === 'text/plain'
  if (mime && !MIME_BY_KIND[type].includes(mime) && !isTextPlainJson) {
    return {
      ok: false,
      type: null,
      message: `This file reports itself as ${mime}, which does not match a ${type.toUpperCase()} resume. ${UNSUPPORTED_MESSAGE}`,
      code: 'unsupported-format',
    }
  }

  return { ok: true, type, message: '', code: '' }
}

// Reads a small prefix only, so a wrong file can be caught without pulling the
// whole document into memory.
async function readPrefix(file, byteLength) {
  const buffer = await file.slice(0, byteLength).arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let text = ''
  for (let i = 0; i < bytes.length; i += 1) text += String.fromCharCode(bytes[i])
  return { bytes, text }
}

function startsWithZipMagic(bytes) {
  // "PK\x03\x04" — every OOXML .docx is a zip container.
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04
}

async function loadPdfJs() {
  try {
    // pdf.js ships a `legacy` build for environments without modern browser
    // syntax. The extra few kilobytes buy support for older browsers, and it
    // keeps this module importable from Node for tests.
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    await configurePdfWorker(pdfjs)
    return pdfjs
  } catch {
    throw new ResumeFileError(
      'The PDF reader could not be loaded. Check your connection and try again, or upload the resume as DOCX or JSON.',
      'reader-unavailable',
    )
  }
}

// pdf.js runs its parsing on a Web Worker. Vite can hand out the worker file as
// an asset URL, which is what the browser build needs; outside a browser (the
// Node test harness) pdf.js has its own worker-less fallback, so the URL is
// skipped there.
async function configurePdfWorker(pdfjs) {
  if (typeof document === 'undefined') return
  try {
    const workerModule = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
    pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default || workerModule
  } catch {
    /* Leave pdf.js defaults in place. */
  }
}

// ===== PDF text layout reconstruction =====
//
// pdf.js returns positioned text runs, not lines, and the order of those runs
// follows the content stream, which is not reading order. Three separate things
// are needed to rebuild something a section parser can read:
//
//   1. line grouping - runs that share a baseline belong to one visual line;
//   2. left-to-right order inside that line, taken from the x position;
//   3. the gap between two runs, which says whether the author left a word
//      space there or placed the fragments flush against each other.
//
// Comparing a run only with the run that happens to precede it gives wrong
// answers as soon as the text layer interleaves anything that is not body text
// (an icon run, a page header, a second column): the comparison is then made
// against the wrong run, so real line breaks are never emitted and words are
// pasted together. Runs are therefore collected into lines first and sorted
// afterwards, and every separator decision below uses the measured gap.

const LINE_TOLERANCE = 2
const MIN_SPACE_UNITS = 1
// A word space is roughly a quarter of the font size, so the threshold is
// expressed in em rather than in fixed units; a fixed unit threshold means
// something different at 8pt and at 20pt.
const SPACE_EM = 0.2
// A gap this wide is not a word space but the jump to another column or block,
// which must become a line break rather than a space.
const COLUMN_EM = 3
const FALLBACK_FONT_SIZE = 10
const ARTIFACT_RUN_MAX_LENGTH = 12

// Some PDFs emit a drawing that was authored as vector art as an ordinary text
// run carrying the authoring tool's marker name instead of any word. On a real
// resume these arrive in the middle of a line, sitting between two genuine
// fragments - an icon between two contact fields - and glue themselves to both
// neighbours, so "gmail.com" + icon + "linkedin.com" extracts as one run-on
// string with the marker buried inside it.
//
// The marker must be the entire run, so a skill such as "Graphic Design" or a
// sentence containing the word "image" is never touched, and a run is only
// dropped when real text sits on both sides of it, which is exactly the shape of
// an inline icon and never the shape of a standalone word.
const ARTIFACT_RUN_MARKERS = new Set([
  'svg',
  'img',
  'icon',
  'pict',
  'wmf',
  'emf',
  'shapetype',
  'graphicframe',
  'inline',
  'anchor',
  'textbox',
])

function fontSizeOf(transform) {
  if (!transform) return 0
  const horizontal = Math.abs(transform[0])
  const vertical = Math.abs(transform[3])
  return horizontal || vertical || 0
}

function effectiveFontSize(fontSize) {
  return fontSize > 0 ? fontSize : FALLBACK_FONT_SIZE
}

function spaceThreshold(fontSize) {
  return Math.max(MIN_SPACE_UNITS, effectiveFontSize(fontSize) * SPACE_EM)
}

function columnThreshold(fontSize) {
  return effectiveFontSize(fontSize) * COLUMN_EM
}

function gapBetween(prev, run) {
  if (prev.x === null || run.x === null) return null
  return run.x - (prev.x + prev.width)
}

function isArtifactText(str) {
  const marker = str.trim().toLowerCase()
  return marker.length > 0 && marker.length <= ARTIFACT_RUN_MAX_LENGTH && ARTIFACT_RUN_MARKERS.has(marker)
}

/**
 * Decides whether two adjacent fragments on one baseline were separated by a
 * space in the original document.
 *
 * The measured gap is used whenever there is one. The extra check exists for
 * PDFs that place a word and the next word at the same x as the end of the
 * previous one: there is no gap at all, yet the author clearly meant two words
 * ("Programming" + "and"). That is only assumed when the join is letter to
 * lowercase letter, which is what a lost word space looks like. Anything else -
 * a capital after a capital, a digit after a digit, overlapping runs - is left
 * alone, because a space there would corrupt camel-cased words and kerned text.
 */
function needsWordSpace(prevStr, nextStr) {
  if (/\s$/.test(prevStr)) return false
  if (/^\s/.test(nextStr)) return false
  if (!/[A-Za-z0-9]$/.test(prevStr)) return false
  return /^[a-z]/.test(nextStr)
}

function joinRuns(runs, fontSize) {
  let text = ''
  let prev = null
  for (const run of runs) {
    if (prev) {
      // A null gap means neither run had a position, so nothing can be measured
      // and nothing is inserted - the same choice the previous implementation
      // made for those runs.
      const gap = gapBetween(prev, run)
      if (gap > spaceThreshold(fontSize) || (gap !== null && gap >= 0 && needsWordSpace(prev.str, run.str))) {
        text += ' '
      }
    }
    text += run.str
    prev = run
  }
  return text
}

/**
 * Removes inline artifact runs from one line and turns the horizontal space
 * each of them occupied into a real space, so the fragments that surrounded the
 * icon are not pasted together after the marker is gone.
 */
function dropArtifactRuns(runs) {
  if (!runs.some((run) => run.isArtifact)) return runs
  const kept = []
  for (let i = 0; i < runs.length; i += 1) {
    const run = runs[i]
    if (!run.isArtifact) {
      kept.push(run)
      continue
    }
    // A marker that is the only thing on its line is kept: there is no
    // neighbouring text to protect, so deleting it would be a guess. A marker
    // sitting next to real text is an inline icon and is removed, whether it
    // leads the line, trails it, or sits between two fragments.
    const hasContentBefore = runs.slice(0, i).some((r) => !r.isArtifact && r.str.trim())
    const hasContentAfter = runs.slice(i + 1).some((r) => !r.isArtifact && r.str.trim())
    if (!hasContentBefore && !hasContentAfter) {
      kept.push(run)
      continue
    }
    if (run.width > 0) {
      // The icon occupied real horizontal space between the fragments, so that
      // space becomes a word space and the fragments are no longer glued
      // together once the marker itself is gone. The placeholder keeps the
      // original x and width so the next gap is still measured from the same
      // place and does not produce a second space.
      kept.push({ x: run.x, width: run.width, str: ' ' })
    }
    // A marker with no width occupied no space either, so it is removed outright
    // and the fragments it separated stay exactly as close as they were.
  }
  return kept
}

function lineToText(line) {
  // Runs without a position cannot be placed, so they keep the order they
  // arrived in; everything else is laid out left to right.
  const sorted = line.runs.slice().sort((a, b) => {
    if (a.x === null || b.x === null) return 0
    return a.x - b.x
  })
  const kept = dropArtifactRuns(sorted)
  if (kept.length === 0) return ''

  // A wide gap inside a line is a column or block boundary. Emitting a line
  // break there keeps the two blocks apart; joining them with a space would run
  // a right-hand column into the left-hand one and let one section's text bleed
  // into the next.
  const segments = [[]]
  let prev = null
  for (const run of kept) {
    if (prev) {
      const gap = gapBetween(prev, run)
      if (gap !== null && gap > columnThreshold(line.fontSize)) segments.push([])
    }
    segments[segments.length - 1].push(run)
    prev = run
  }

  return segments
    .map((segment) => joinRuns(segment, line.fontSize))
    .filter((segment) => segment.length > 0)
    .join('\n')
}

/**
 * Rebuilds reading-order text from pdf.js text runs.
 *
 * Exported so the layout rules can be exercised directly by tests; the import
 * pipeline itself only uses it through extractPdfText.
 */
export function pdfItemsToText(items) {
  const lines = []
  let forceNewLine = false

  for (const item of items || []) {
    if (!item || typeof item.str !== 'string' || item.str === '') continue
    const transform = Array.isArray(item.transform) ? item.transform : null
    const x = transform ? transform[4] : null
    const y = transform ? transform[5] : null
    const fontSize = fontSizeOf(transform)

    // Reuse the most recent line that shares this baseline, so a heading keeps
    // the line it belongs to even when other runs sit between its words.
    let line = null
    if (!forceNewLine) {
      if (y === null) {
        // Without a position there is no baseline to compare, so consecutive
        // unpositioned runs stay together instead of becoming separate lines.
        const last = lines[lines.length - 1]
        if (last && last.y === null) line = last
      } else {
        for (let i = lines.length - 1; i >= 0; i -= 1) {
          if (lines[i].y !== null && Math.abs(lines[i].y - y) <= LINE_TOLERANCE) {
            line = lines[i]
            break
          }
        }
      }
    }
    if (!line) {
      line = { y, fontSize, runs: [] }
      lines.push(line)
    } else if (line.fontSize === 0 && fontSize > 0) {
      // Keep the largest size seen on the line so gap thresholds are judged
      // against the body text rather than a single small run.
      line.fontSize = fontSize
    }

    line.runs.push({
      x,
      width: typeof item.width === 'number' ? item.width : 0,
      str: item.str,
      isArtifact: isArtifactText(item.str),
    })

    // pdf.js flags the end of a line itself; honour it so documents that carry
    // their own breaks keep them.
    forceNewLine = !!item.hasEOL
  }

  return rejoinWrappedUrls(sortLinesByReadingOrder(lines))
    .filter((line) => line.length > 0)
    .join('\n')
}

/**
 * Restores the order a reader sees.
 *
 * pdf.js emits text runs in content-stream order: the order the tool that wrote
 * the file drew them, which is block by block and not top to bottom. A resume
 * laid out in blocks therefore arrives with its skills list ahead of the name
 * printed above it, its project heading above the education it never belonged
 * to, and its contact block in the middle of the summary. Every heading-driven
 * parser downstream reads that as the document's real structure.
 *
 * The baselines carry the true layout, so the lines are re-sorted by them. PDF y
 * grows upward, so descending y is top-to-bottom on the page; the sort is stable,
 * which keeps runs sharing a baseline in the order they were drawn. A line with
 * no usable baseline inherits the one it arrived behind, so an unpositioned run
 * stays beside its neighbours instead of being flung to an end.
 *
 * @param {Array<{y: number|null}>} lines
 * @returns {Array<{y: number|null}>}
 */
function sortLinesByReadingOrder(lines) {
  let lastY = null
  const ordered = lines.map((line) => {
    if (line.y !== null) lastY = line.y
    return { line, orderY: lastY }
  })

  ordered.sort((a, b) => {
    if (a.orderY === null || b.orderY === null) return 0
    return b.orderY - a.orderY
  })

  return ordered.map((entry) => entry.line)
}

/** Horizontal extent of a line, ignoring runs that carry no position. */
// A URL that runs out of room on its line spills the rest of its path onto a
// line of its own, which would otherwise leave the link cut off mid-address.
const INCOMPLETE_URL = /(?:https?:\/\/)?(?:www\.)?[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+\/[A-Za-z0-9._%/-]*[-/]$/
// One unbroken token, so never a sentence. A letter is required: a run of bare
// digits sitting under a contact row is a phone number that wrapped, not a path.
function isUrlTail(run) {
  if (run.x === null || !/^[A-Za-z0-9][A-Za-z0-9._%/-]*$/.test(run.str)) return false
  return /[A-Za-z]/.test(run.str)
}

function runSpans(run) {
  return { left: run.x, right: run.x + (run.width > 0 ? run.width : 0) }
}

/**
 * Finds the run holding the URL that a wrapped tail completes.
 *
 * A centred contact row draws several links on one baseline, so the tails all
 * land below the row and adjacency says nothing. What identifies the link is the
 * column the tail sits in, so a candidate only counts when it horizontally
 * overlaps the tail.
 *
 * @returns {{line: number, run: number}|null}
 */
function findUrlHost(lines, fromIndex, tail) {
  const span = runSpans(tail)
  for (let j = fromIndex - 1; j >= 0 && j >= fromIndex - 4; j -= 1) {
    for (let r = lines[j].runs.length - 1; r >= 0; r -= 1) {
      const run = lines[j].runs[r]
      if (run.x === null || !INCOMPLETE_URL.test(run.str)) continue
      const host = runSpans(run)
      if (span.right > host.left && span.left < host.right) return { line: j, run: r }
    }
  }
  return null
}

/**
 * Rejoins the tail of a URL that wrapped onto the next line.
 *
 * The tail is put back on the URL's own run, so the joined line is laid out
 * again from its runs and the tail keeps the address unbroken.
 *
 * @param {Array<{y: number|null, runs: Array<object>}>} lines In reading order.
 * @returns {string[]}
 */
function rejoinWrappedUrls(lines) {
  const texts = lines.map(lineToText)
  const consumed = new Set()
  // Where the next search on a line starts, so a second tail on the same URL is
  // placed after the first rather than in front of it.
  const cursors = new Map()

  for (let i = 0; i < lines.length; i += 1) {
    const tails = lines[i].runs.filter(isUrlTail)
    // A line that also holds real words is content in its own right, so only a
    // line made entirely of tails is treated as a wrap.
    const hasOtherText = lines[i].runs.some(
      (run) => run.str.trim() && !/^[A-Za-z0-9][A-Za-z0-9._%/-]*$/.test(run.str),
    )
    if (!tails.length || hasOtherText) continue

    let placed = 0
    for (const tail of tails) {
      const host = findUrlHost(lines, i, tail)
      if (!host) break
      const run = lines[host.line].runs[host.run]
      const from = cursors.get(host.line) || 0
      const at = texts[host.line].indexOf(run.str, from)
      if (at === -1) break
      const cut = at + run.str.length
      texts[host.line] = texts[host.line].slice(0, cut) + tail.str + texts[host.line].slice(cut)
      cursors.set(host.line, cut + tail.str.length)
      placed += 1
    }

    // The line is only a wrap if every tail on it found its URL; a tail left
    // over means the line carries content that has to survive.
    if (placed === tails.length) consumed.add(i)
  }

  return texts.filter((text, index) => !consumed.has(index))
}

/** Exported for tests, alongside pdfItemsToText. */
export function tidyPageText(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** "2", "2, 3", "2-4" - used to name the pages that could not be read. */
function formatPageList(numbers) {
  const sorted = [...new Set(numbers)].sort((a, b) => a - b)
  const parts = []
  let start = sorted[0]
  let previous = sorted[0]
  for (let i = 1; i <= sorted.length; i += 1) {
    const current = sorted[i]
    if (current === previous + 1) {
      previous = current
      continue
    }
    parts.push(start === previous ? `${start}` : `${start}-${previous}`)
    start = current
    previous = current
  }
  return parts.join(', ')
}

// A header or footer is normally repeated verbatim on every page. Left in place
// it re-enters the section parser once per page and can be mistaken for content,
// so a short line already seen on an earlier page is dropped from later pages.
// Long lines are left alone: those are body text that happens to repeat.
const REPEATED_LINE_MAX_LENGTH = 80

function removeRepeatedHeaderFooter(pageTexts) {
  if (pageTexts.length < 2) return pageTexts
  const seen = new Set()
  return pageTexts.map((pageText, index) =>
    pageText
      .split('\n')
      .filter((line) => {
        const key = line.trim().replace(/\s+/g, ' ').toLowerCase()
        if (!key || key.length > REPEATED_LINE_MAX_LENGTH) return true
        if (index === 0) {
          seen.add(key)
          return true
        }
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .join('\n'),
  )
}

async function extractPdfText(file) {
  const prefix = await readPrefix(file, 8)
  if (!prefix.text.startsWith('%PDF-')) {
    throw new ResumeFileError(
      'That file has a .pdf name but is not a PDF document. Please upload a real PDF resume.',
      'invalid-file',
    )
  }

  const pdfjs = await loadPdfJs()

  let doc
  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false }).promise
  } catch {
    throw new ResumeFileError(
      'This PDF could not be opened. It may be corrupt, damaged, or password-protected.',
      'corrupt-file',
    )
  }

  const warnings = []
  const pageTexts = []
  const totalPages = typeof doc.numPages === 'number' ? doc.numPages : 0
  const pagesToRead = Math.min(totalPages, MAX_PDF_PAGES)

  for (let pageNumber = 1; pageNumber <= pagesToRead; pageNumber += 1) {
    try {
      const page = await doc.getPage(pageNumber)
      const content = await page.getTextContent()
      pageTexts.push(tidyPageText(pdfItemsToText(content.items)))
      if (typeof page.cleanup === 'function') page.cleanup()
    } catch {
      // A single unreadable page must not lose the rest of the resume.
      pageTexts.push('')
      warnings.push(`Page ${pageNumber} could not be read and was left out.`)
    }
  }

  if (typeof doc.destroy === 'function') {
    try {
      await doc.destroy()
    } catch {
      /* ignore */
    }
  }

  const cleanedPages = removeRepeatedHeaderFooter(pageTexts)

  // Which pages carry usable text is decided from the cleaned pages, so the
  // reported split always matches the text that is actually returned.
  const pagesWithText = []
  const pagesWithoutText = []
  cleanedPages.forEach((pageText, index) => {
    ;(pageText.trim() ? pagesWithText : pagesWithoutText).push(index + 1)
  })

  // Page order is the order the pages were read in; page breaks become blank
  // lines so the section parser sees the same document a reader would. Pages
  // that yielded nothing are left out of the text rather than joined in as gaps,
  // so a scanned page cannot be mistaken for a section break in the text.
  const text = cleanedPages.filter((page) => page.length > 0).join('\n\n')

  if (!text.trim()) {
    throw new ResumeFileError(
      totalPages > 1
        ? `No text could be read from any of the ${totalPages} pages in this PDF, which means it is a scan or an image-only document. Scanned PDFs are not supported because no OCR is applied. Upload a text-based PDF, a .docx file, or a ResumeBuilder JSON export instead.`
        : 'No text could be read from this PDF, which means it is a scan or an image-only document. Scanned PDFs are not supported because no OCR is applied. Upload a text-based PDF, a .docx file, or a ResumeBuilder JSON export instead.',
      'no-extractable-text',
    )
  }

  if (totalPages > pagesToRead) {
    warnings.push(
      `This PDF has ${totalPages} pages. Only the first ${pagesToRead} were read to keep the import fast.`,
    )
  }

  // A partially readable document is imported, but never silently: the pages
  // that could not be read are named, and the user is told the result is
  // incomplete instead of being allowed to assume the whole file was read.
  if (pagesWithoutText.length > 0) {
    const missing = formatPageList(pagesWithoutText)
    warnings.push(
      `Some pages could not be read as text (page ${missing} of ${totalPages}). OCR may be required for those pages, so that part of the resume is missing from this import. The pages that could be read were still imported.`,
    )
  }

  return {
    kind: 'pdf',
    text,
    pageCount: totalPages,
    totalPages,
    pagesWithText,
    pagesWithoutText,
    hasPartialText: pagesWithoutText.length > 0,
    warnings,
  }
}

async function loadMammoth() {
  try {
    const module = await import('mammoth/mammoth.browser.min.js')
    return module.default || module
  } catch {
    throw new ResumeFileError(
      'The Word document reader could not be loaded. Check your connection and try again, or upload the resume as PDF or JSON.',
      'reader-unavailable',
    )
  }
}

async function extractDocxText(file) {
  const prefix = await readPrefix(file, 4)
  if (!startsWithZipMagic(prefix.bytes)) {
    throw new ResumeFileError(
      'That file is not a .docx Word document. Word 97-2003 ".doc" files are not supported — use "Save As" to create a .docx file.',
      'invalid-file',
    )
  }

  const mammoth = await loadMammoth()

  let result
  try {
    result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
  } catch {
    throw new ResumeFileError(
      'This Word document could not be opened. If it is an old .doc file, re-save it as .docx and try again.',
      'corrupt-file',
    )
  }

  const text = typeof result?.value === 'string' ? result.value : ''
  if (!text.trim()) {
    throw new ResumeFileError(
      'This Word document contains no readable text.',
      'no-extractable-text',
    )
  }

  // mammoth reports unreadable content (text boxes, embedded objects) here.
  // Those parts are skipped, but the rest of the resume is still usable.
  const warnings = (Array.isArray(result?.messages) ? result.messages : [])
    .filter((message) => message && message.type === 'warning' && message.message)
    .slice(0, 5)
    .map((message) => `Some Word formatting could not be read (${message.message}).`)

  return {
    kind: 'docx',
    text: text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(),
    pageCount: 0,
    totalPages: 0,
    pagesWithText: [],
    pagesWithoutText: [],
    hasPartialText: false,
    warnings,
  }
}

async function extractJsonText(file) {
  const prefix = await readPrefix(file, 64)
  if (prefix.text.trim() && !/^[[{]/.test(prefix.text.trim())) {
    throw new ResumeFileError(
      'That file has a .json name but does not contain JSON. Export the resume again from ResumeBuilder.',
      'invalid-file',
    )
  }
  return {
    kind: 'json',
    text: await file.text(),
    pageCount: 0,
    totalPages: 0,
    pagesWithText: [],
    pagesWithoutText: [],
    hasPartialText: false,
    warnings: [],
  }
}

/**
 * Reads a resume file and returns its text.
 *
 * @param {File} file File picked by the user.
 * @returns {Promise<{
 *   kind: 'json'|'pdf'|'docx',
 *   text: string,
 *   pageCount: number,
 *   totalPages: number,
 *   pagesWithText: number[],
 *   pagesWithoutText: number[],
 *   hasPartialText: boolean,
 *   warnings: string[],
 * }>}
 *   For a PDF, `pagesWithText` / `pagesWithoutText` are 1-based page numbers and
 *   `hasPartialText` is true when the document was only partly readable. The
 *   readable text is still returned in that case; `pagesWithoutText` and the
 *   matching warning say what is missing. DOCX and JSON are read as one whole
 *   document, so they report no pages and no partial state.
 * @throws {ResumeFileError} with a stable `code`: 'unsupported-format',
 *   'file-too-large', 'invalid-file', 'corrupt-file', 'no-extractable-text' or
 *   'reader-unavailable'.
 */
export async function extractResumeText(file) {
  const validation = validateResumeFile(file)
  if (!validation.ok) {
    throw new ResumeFileError(validation.message, validation.code || 'unsupported-format')
  }

  if (validation.type === 'pdf') return extractPdfText(file)
  if (validation.type === 'docx') return extractDocxText(file)
  return extractJsonText(file)
}

export default extractResumeText