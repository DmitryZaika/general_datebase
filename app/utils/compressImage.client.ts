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
