import { jsPDF } from 'jspdf'

// The editor already renders the resume into the DOM with the selected template,
// layout (single / two-column / sidebar / modern-grid), header style, colours,
// fonts, photo, QR code, spacing, icons and section order applied. Exporting the
// PDF from that exact element through jsPDF's HTML pipeline keeps the download
// visually identical to the live preview instead of rebuilding a separate
// single-column document by hand.
const PREVIEW_SELECTOR = '[data-resume-preview="true"]'

// The preview is authored at a fixed 800px width (see ResumePreviewPanel's
// BASE_PAGE_WIDTH) and only visually scaled with CSS zoom. Rendering the clone
// at that same intrinsic width maps it onto a full A4 page without inheriting
// the editor's zoom level.
const PREVIEW_WIDTH_PX = 800
const A4_WIDTH_MM = 210

function waitForPreviewAssets(source) {
  const fontsReady = document.fonts && document.fonts.ready
    ? document.fonts.ready.catch(() => {})
    : Promise.resolve()

  const imagesReady = Array.from(source.querySelectorAll('img')).map((img) => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve()
    return new Promise((resolve) => {
      img.addEventListener('load', () => resolve(), { once: true })
      img.addEventListener('error', () => resolve(), { once: true })
    })
  })

  return Promise.all([fontsReady, ...imagesReady])
}

async function renderPreviewToPdf(source, fileName) {
  await waitForPreviewAssets(source)

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // width (mm) + windowWidth (px) tells jsPDF to scale the 800px preview onto
  // the full A4 width. `autoPaging: 'text'` breaks between text lines so long
  // resumes paginate without slicing content in half or emitting blank pages.
  await pdf.html(source, {
    x: 0,
    y: 0,
    width: A4_WIDTH_MM,
    windowWidth: PREVIEW_WIDTH_PX,
    autoPaging: 'text',
    margin: [0, 0, 0, 0],
    html2canvas: {
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: PREVIEW_WIDTH_PX,
    },
  })

  pdf.save(fileName)
}

// Resolves the exact preview element to export. When a caller supplies a root
// (the card / editor panel that owns the click), the search is confined to it so
// a page with several previews — e.g. the Resume Vault or an open version modal —
// can never export a different resume. A supplied root that contains no preview
// resolves to null rather than falling through to the rest of the document.
function resolvePreviewElement(options) {
  const hasRoot = options != null && 'root' in options
  const root = hasRoot ? options.root : null

  if (root instanceof Element) {
    return root.matches(PREVIEW_SELECTOR) ? root : root.querySelector(PREVIEW_SELECTOR)
  }

  // A root was explicitly supplied but is not an element (e.g. a ref that has
  // not attached yet); refuse rather than guess at another resume's preview.
  if (hasRoot) return null

  return document.querySelector(PREVIEW_SELECTOR)
}

export async function generatePDF(formData, resumeType, configOrId = null, options = {}) {
  // These arguments are kept so FresherEditor / ExperiencedEditor keep calling
  // this function unchanged; the live preview already reflects them (the QR code
  // included, because it is rendered into the preview element that gets captured).
  void resumeType
  void configOrId

  const pi = (formData && formData.personalInfo) || {}
  const fileName = `${(pi.fullName || 'resume').replace(/\s+/g, '_')}_Resume.pdf`

  const source = resolvePreviewElement(options)
  if (!source) {
    // Never silently fall back to the old hand-built document, and never export
    // another resume's preview that happens to be elsewhere on the page.
    throw new Error('Resume preview not found; cannot export PDF.')
  }

  // jsPDF's HTML pipeline is asynchronous, so the returned promise is settled
  // only once the file has actually been handed to the browser. Callers await
  // this before counting a download, which keeps the counter from incrementing
  // while generation is still running — or after a failed export. A failure
  // rejects here and is surfaced by the caller instead of being swallowed.
  await renderPreviewToPdf(source, fileName)

  return fileName
}
