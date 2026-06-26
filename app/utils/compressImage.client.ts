import Compressor from 'compressorjs'

export function getImageCompressionQuality(size: number): number {
  const SEVEN_MB = 7 * 1024 * 1024
  const FIVE_MB = 5 * 1024 * 1024
  const THREE_MB = 3 * 1024 * 1024
  const ONE_MB = 1 * 1024 * 1024

  if (size > SEVEN_MB) {
    return 0.3
  }
  if (size > FIVE_MB) {
    return 0.35
  }
  if (size > THREE_MB) {
    return 0.4
  }
  if (size > ONE_MB) {
    return 0.5
  }
  return 0.7
}

export function isCompressibleImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

export function compressImageFile(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    new Compressor(file, {
      quality: getImageCompressionQuality(file.size),
      success(result) {
        if (result instanceof File) {
          resolve(result)
        } else {
          resolve(new File([result], file.name, { type: file.type || 'image/jpeg' }))
        }
      },
      error: reject,
    })
  })
}

export async function compressImageFiles(files: File[]): Promise<File[]> {
  const out: File[] = []
  for (const file of files) {
    if (isCompressibleImageFile(file)) {
      out.push(await compressImageFile(file))
    } else {
      out.push(file)
    }
  }
  return out
}

export async function resizeImageToMaxHeight(
  file: File,
  maxHeight: number,
): Promise<File> {
  if (maxHeight <= 0 || !isCompressibleImageFile(file)) {
    return file
  }

  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      if (img.height <= maxHeight) {
        resolve(file)
        return
      }

      const scale = maxHeight / img.height
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.width * scale))
      canvas.height = Math.max(1, Math.round(img.height * scale))

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(file)
        return
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        blob => {
          if (!blob) {
            resolve(file)
            return
          }
          resolve(new File([blob], file.name, { type: file.type || 'image/png' }))
        },
        file.type || 'image/png',
        0.92,
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to load image'))
    }

    img.src = objectUrl
  })
}
