const IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'bmp',
  'svg',
  'heic',
  'heif',
  'tiff',
  'tif',
])

export function attachmentPreviewKey(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`
}

export function isImageFileName(fileName: string): boolean {
  const parts = fileName.split('.')
  const ext = parts.length > 1 ? parts.pop()?.toLowerCase() || '' : ''
  return IMAGE_EXTENSIONS.has(ext)
}

export function buildImageAttachmentPreviews(files: File[]): Record<string, string> {
  const previews: Record<string, string> = {}
  for (const file of files) {
    if (!isImageFileName(file.name)) continue
    previews[attachmentPreviewKey(file)] = URL.createObjectURL(file)
  }
  return previews
}
