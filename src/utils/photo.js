// Profile photo handling.
//
// A photo is embedded in the resume document as a base64 data URL. Storing the
// raw upload made two things break: an 8 MB phone photo produced a ~10 MB string
// that Firestore rejects (1 MiB document limit), and the PDF exporter assumed
// every photo was JPEG, so PNG uploads silently failed to render.
//
// Photos are therefore validated, downscaled to a sensible avatar size and
// re-encoded as JPEG before being stored.

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024
export const PHOTO_EDGE_PX = 320
export const MAX_STORED_PHOTO_BYTES = 120 * 1024

const ALLOWED_TYPES = ['image/jpeg', 'image/jpeg', 'image/png', 'image/webp']
const ALLOWED_EXT = /(\.jpg|\.jpeg|\.png|\.webp)$/i

export function validatePhotoFile(file) {
  if (!file) {
    return { ok: false, message: 'No file selected.' }
  }
  if (file.type) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { ok: false, message: 'Please choose a JPG, JPEG, PNG or WEBP image.' }
    }
  } else {
    const name = file.name || ''
    if (!ALLOWED_EXT.test(name)) {
      return { ok: false, message: 'Please choose a JPG, JPEG, PNG or WEBP image.' }
    }
  }
  if (file.size > MAX_PHOTO_BYTES) {
    const mb = (MAX_PHOTO_BYTES / (1024 * 1024)).toFixed(0)
    return { ok: false, message: `That image is too large. Please pick one under ${mb} MB.` }
  }
  return { ok: true }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('The image could not be read.'))
    img.src = src
  })
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('The image could not be read.'))
    reader.readAsDataURL(file)
  })
}

function canvasToDataUrl(canvas, quality) {
  return canvas.toDataURL('image/jpeg', quality)
}

/**
 * Validates, downscales and re-encodes an uploaded photo.
 * Resolves to a compact JPEG data URL, or throws with a user-facing message.
 */
export async function normalizePhoto(file) {
  const validation = validatePhotoFile(file)
  if (!validation.ok) {
    throw new Error(validation.message)
  }

  const source = await readAsDataUrl(file)
  const img = await loadImage(source)

  const longestEdge = Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height)
  const scale = longestEdge > PHOTO_EDGE_PX ? PHOTO_EDGE_PX / longestEdge : 1
  const width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale))
  const height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)

  let output = canvasToDataUrl(canvas, 0.85)
  // Step the quality down until the encoded photo fits comfortably inside a
  // resume document, rather than failing the save at the Firestore limit.
  for (const quality of [0.7, 0.55, 0.4]) {
    if (output.length <= MAX_STORED_PHOTO_BYTES) break
    output = canvasToDataUrl(canvas, quality)
  }

  if (output.length > MAX_STORED_PHOTO_BYTES) {
    throw new Error('That photo is too detailed to store. Please try a smaller or simpler image.')
  }
  return output
}

/**
 * jsPDF needs the real image format. Data URLs carry it in the MIME type, so
 * read it from there instead of assuming every photo is JPEG.
 */
export function detectImageFormat(dataUrl) {
  if (typeof dataUrl !== 'string') return 'JPEG'
  if (/^data:image\/png/i.test(dataUrl)) return 'PNG'
  if (/^data:image\/(webp|gif|bmp)/i.test(dataUrl)) return 'JPEG'
  if (/^data:image\//i.test(dataUrl)) return 'JPEG'
  return 'JPEG'
}
