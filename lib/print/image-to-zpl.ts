/**
 * Convert an image URL to ZPL ^GFA graphic data using browser Canvas API.
 * Returns the full ^GFA command string ready to insert into a ZPL label.
 *
 * Process: load image → resize to target dots → grayscale → threshold → 1-bit pack → hex
 */
export async function convertImageToZPL(
  imageUrl: string,
  widthDots: number,
  heightDots: number,
  threshold = 128
): Promise<string> {
  const img = await loadImage(imageUrl)

  // Scale to fit within target dimensions, preserving aspect ratio
  const scale = Math.min(widthDots / img.width, heightDots / img.height)
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)

  // Draw onto canvas
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)

  const imageData = ctx.getImageData(0, 0, w, h)
  const pixels = imageData.data

  // Bytes per row must align to full bytes (8 pixels per byte)
  const bytesPerRow = Math.ceil(w / 8)
  const totalBytes = bytesPerRow * h
  const hexChars: string[] = []

  for (let row = 0; row < h; row++) {
    for (let byteIdx = 0; byteIdx < bytesPerRow; byteIdx++) {
      let byte = 0
      for (let bit = 0; bit < 8; bit++) {
        const col = byteIdx * 8 + bit
        if (col < w) {
          const px = (row * w + col) * 4
          // Grayscale = weighted average
          const gray = pixels[px] * 0.299 + pixels[px + 1] * 0.587 + pixels[px + 2] * 0.114
          // In ZPL, 1 = black, 0 = white
          if (gray < threshold) {
            byte |= (1 << (7 - bit))
          }
        }
        // else padding bits stay 0 (white)
      }
      hexChars.push(byte.toString(16).toUpperCase().padStart(2, '0'))
    }
  }

  const hexData = hexChars.join('')
  // ^GFA,totalBytes,totalBytes,bytesPerRow,hexData
  return `^GFA,${totalBytes},${totalBytes},${bytesPerRow},${hexData}`
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = url
  })
}
