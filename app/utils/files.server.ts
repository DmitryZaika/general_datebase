import sharp from 'sharp'

export async function compressImage(original: Buffer) {
  return await sharp(original).rotate().resize(480, 320, { fit: 'fill' }).toBuffer()
}

type HeicConvertFn = (opts: {
  buffer: Buffer | Uint8Array
  format: 'JPEG' | 'PNG'
  quality?: number
}) => Promise<Uint8Array | ArrayBuffer>

async function loadHeicConvert(): Promise<HeicConvertFn> {
  const mod = await import('heic-convert')
  return (mod.default ?? mod) as HeicConvertFn
}

async function convertWithHeicConvert(original: Buffer): Promise<Buffer> {
  const convert = await loadHeicConvert()
  const output = await convert({
    buffer: original,
    format: 'JPEG',
    quality: 0.92,
  })
  if (output instanceof ArrayBuffer) {
    return Buffer.from(output)
  }
  return Buffer.from(output.buffer, output.byteOffset, output.length)
}

async function convertWithHeicConvertAll(original: Buffer): Promise<Buffer> {
  const mod = await import('heic-convert')
  // Direct cast to the module type handles common interop setups cleanly
  const convert = (mod.default ?? mod) as typeof import('heic-convert')

  if (!convert.all) {
    return await convertWithHeicConvert(original)
  }

  // TypeScript now natively knows the correct parameters and return shapes here
  const outputs = await convert.all({
    buffer: original,
    format: 'JPEG',
    quality: 0.92,
  })

  const firstImage = outputs[0]
  if (!firstImage) throw new Error('heic-convert returned no images')

  // The official types reveal we must call .convert() on the image instance
  const actualArrayBuffer = await firstImage.convert()

  return Buffer.from(actualArrayBuffer)
}

export async function convertHeicToJpeg(original: Buffer): Promise<Buffer> {
  try {
    return await convertWithHeicConvert(original)
  } catch {
    try {
      return await convertWithHeicConvertAll(original)
    } catch {
      return await sharp(original).rotate().jpeg({ quality: 90 }).toBuffer()
    }
  }
}
