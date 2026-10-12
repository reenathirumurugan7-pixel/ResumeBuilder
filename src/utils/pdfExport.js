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

export function generatePDF(formData, resumeType, configOrId = null, options = {}) {
  // These arguments are kept so FresherEditor / ExperiencedEditor keep calling
  // this function unchanged; the live preview already reflects them.
  void resumeType
  void configOrId
  void options

  const pi = (formData && formData.personalInfo) || {}
  const fileName = `${(pi.fullName || 'resume').replace(/\s+/g, '_')}_Resume.pdf`

  const source = document.querySelector(PREVIEW_SELECTOR)
  if (!source) {
    // Never silently fall back to the old hand-built document.
    window.alert('We could not find your resume preview to export. Please reopen the editor and try again.')
    return null
  }

  // jsPDF's HTML pipeline is asynchronous but callers expect the filename
  // synchronously, so the download is produced in the background and any
  // failure is surfaced to the user instead of being swallowed.
  renderPreviewToPdf(source, fileName).catch((error) => {
    console.error('PDF export failed', error)
    window.alert('Sorry, we could not generate your PDF. Please try again.')
  })

  return fileName
}
