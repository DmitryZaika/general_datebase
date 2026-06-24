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
  return Buffer.from(output)
}

async function convertWithHeicConvertAll(original: Buffer): Promise<Buffer> {
  const mod = await import('heic-convert')
  const convert = mod.default ?? mod
  const convertAll = convert.all as
    | ((opts: {
        buffer: Buffer | Uint8Array
        format: 'JPEG' | 'PNG'
        quality?: number
      }) => Promise<Array<Uint8Array | ArrayBuffer>>)
    | undefined

  if (!convertAll) {
    return await convertWithHeicConvert(original)
  }

  const outputs = await convertAll({
    buffer: original,
    format: 'JPEG',
    quality: 0.92,
  })
  const first = outputs[0]
  if (!first) throw new Error('heic-convert returned no images')
  return Buffer.from(first)
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
