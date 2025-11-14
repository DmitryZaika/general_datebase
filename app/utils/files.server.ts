import sharp from 'sharp'

export async function compressImage(original: Buffer<ArrayBufferLike>) {
    return await sharp(original).rotate().resize(480, 320, { fit: 'fill' }).toBuffer()
  }
  