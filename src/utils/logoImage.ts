/** Logo rules shared by the editor, the cloud company page and uploads (docs: backend-design §4 Logos). */
export const LOGO_MAX_DIMENSION = 600
export const LOGO_MAX_BYTES = 512 * 1024
export const LOGO_JPEG_QUALITY = 0.85

export const fitWithin = (width: number, height: number, max = LOGO_MAX_DIMENSION) => {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/** Decoded size of a base64 `data:` URL. */
export const dataUrlBytes = (dataUrl: string) => {
  const payload = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0
  return Math.floor(payload.length * 3 / 4) - padding
}

/** PNG when it fits; otherwise the JPEG fallback when that fits; otherwise reject. */
export const chooseLogoEncoding = (png: string, jpeg: () => string) => {
  if (dataUrlBytes(png) <= LOGO_MAX_BYTES) return png
  const fallback = jpeg()
  if (dataUrlBytes(fallback) <= LOGO_MAX_BYTES) return fallback
  throw new Error('This logo is too detailed to store (over 512 KB after resizing). Choose a simpler or smaller image.')
}

const decode = (file: Blob) => new Promise<HTMLImageElement>((resolve, reject) => {
  const url = URL.createObjectURL(file)
  const image = new Image()
  image.onload = () => { URL.revokeObjectURL(url); resolve(image) }
  image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This file could not be read as an image.')) }
  image.src = url
})

/** Redraws the image on a canvas: rasterises SVG, keeps the first GIF frame, shrinks to 600 px, saves PNG (JPEG 0.85 on white if over 512 KB). */
export async function normalizeLogo(file: Blob): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please select an image file.')
  const image = await decode(file)
  const sourceWidth = image.naturalWidth || image.width, sourceHeight = image.naturalHeight || image.height
  if (!sourceWidth || !sourceHeight) throw new Error('This image has no readable size.')
  const { width, height } = fitWithin(sourceWidth, sourceHeight)
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Image processing is not available in this browser.')
  context.drawImage(image, 0, 0, width, height)
  return chooseLogoEncoding(canvas.toDataURL('image/png'), () => {
    context.globalCompositeOperation = 'destination-over'; context.fillStyle = '#ffffff'; context.fillRect(0, 0, width, height)
    return canvas.toDataURL('image/jpeg', LOGO_JPEG_QUALITY)
  })
}

/** Normalises a logo that is already a data: URL (for example one stored by an older version). */
export const normalizeLogoDataUrl = async (dataUrl: string) => dataUrl ? normalizeLogo(await (await fetch(dataUrl)).blob()) : ''
