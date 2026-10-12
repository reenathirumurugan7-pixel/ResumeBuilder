import previewCss from '../components/LiveResumePreview.css?inline'

// The resume preview is already rendered to the DOM with the selected template,
// layout, colors, photo and QR code. Printing clones that exact element so the
// output matches the editor preview instead of rebuilding resume HTML by hand.
const PREVIEW_SELECTOR = '[data-resume-preview="true"]'

function waitForImage(img) {
  if (img.complete && img.naturalWidth > 0) return Promise.resolve()
  return new Promise((resolve) => {
    img.addEventListener('load', () => resolve(), { once: true })
    img.addEventListener('error', () => resolve(), { once: true })
  })
}

function collectFontLinks() {
  return Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .filter((link) => /fonts\.(googleapis|gstatic)\.com/.test(link.href))
    .map((link) => `<link rel="stylesheet" href="${link.href}">`)
    .join('\n')
}

export function printResume() {
  const source = document.querySelector(PREVIEW_SELECTOR)
  if (!source) {
    window.alert('We could not find your resume preview to print. Please reopen the editor and try again.')
    return
  }

  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    // Never fall back to printing the current page (the whole dashboard).
    window.alert('Please allow pop-ups for this site to print your resume.')
    return
  }

  const clone = source.cloneNode(true)
  clone.removeAttribute('data-resume-preview')

  const printDoc = printWindow.document
  printDoc.open()
  printDoc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Resume</title>
  ${collectFontLinks()}
  <style>${previewCss}</style>
  <style>
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @page { size: A4; margin: 0; }
    html, body { margin: 0; padding: 0; background: #ffffff; }
    .lrp-page { max-width: none !important; width: 100% !important; margin: 0 !important; }
  </style>
</head>
<body>${clone.outerHTML}</body>
</html>`)
  printDoc.close()

  const fontsReady = printDoc.fonts && printDoc.fonts.ready
    ? printDoc.fonts.ready.catch(() => {})
    : Promise.resolve()
  const imagesReady = Promise.all(Array.from(printDoc.images).map(waitForImage))

  Promise.all([fontsReady, imagesReady]).then(() => {
    printWindow.focus()
    printWindow.print()
  })
}
