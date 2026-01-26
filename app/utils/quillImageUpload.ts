import type Quill from 'quill'

export async function uploadImageToS3(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('image', file)

  const response = await fetch('/api/quill/upload-image', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to upload image')
  }

  const result = await response.json()
  if (!result.url) {
    throw new Error('No URL returned from upload')
  }
  return result.url
}

function isBase64Image(src: string): boolean {
  return src.startsWith('data:image/')
}

function isExternalUrl(src: string): boolean {
  return src.startsWith('http://') || src.startsWith('https://')
}

function isS3Url(src: string): boolean {
  return src.includes('.s3.') && src.includes('.amazonaws.com')
}

async function base64ToFile(base64: string, filename: string): Promise<File> {
  const response = await fetch(base64)
  const blob = await response.blob()
  return new File([blob], filename, { type: blob.type })
}

async function urlToFile(url: string, filename: string): Promise<File> {
  const response = await fetch(url)
  const blob = await response.blob()
  return new File([blob], filename, { type: blob.type })
}

export function setupQuillImageHandlers(quill: Quill): void {
  const toolbar = quill.getModule('toolbar') as {
    addHandler: (format: string, handler: () => void) => void
  } | null

  if (toolbar) {
    toolbar.addHandler('image', () => {
      const input = document.createElement('input')
      input.setAttribute('type', 'file')
      input.setAttribute('accept', 'image/jpeg,image/png,image/gif,image/webp')
      input.click()

      input.onchange = async () => {
        const file = input.files?.[0]
        if (!file) return

        const range = quill.getSelection(true)
        await insertImageWithUpload(quill, file, range.index)
      }
    })
  }

  quill.clipboard.addMatcher('IMG', (node, delta) => {
    const img = node as HTMLImageElement
    const src = img.getAttribute('src') || ''

    if (isS3Url(src)) {
      return delta
    }

    if (isBase64Image(src) || isExternalUrl(src)) {
      setTimeout(async () => {
        const range = quill.getSelection()
        const index = range?.index ?? quill.getLength()

        try {
          let file: File
          if (isBase64Image(src)) {
            file = await base64ToFile(src, `pasted-image-${Date.now()}.png`)
          } else {
            file = await urlToFile(src, `external-image-${Date.now()}.png`)
          }
          await insertImageWithUpload(quill, file, index)
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to process image'
          alert(`Image upload failed: ${message}`)
        }
      }, 0)

      delta.ops = []
    }

    return delta
  })

  quill.root.addEventListener('drop', async (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const files = e.dataTransfer?.files
    if (!files || files.length === 0) return

    const imageFiles = Array.from(files).filter(file =>
      ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type),
    )

    if (imageFiles.length === 0) return

    const range = quill.getSelection(true)
    const startIndex = range?.index ?? quill.getLength()

    await insertMultipleImagesWithUpload(quill, imageFiles, startIndex)
  })

  quill.root.addEventListener('dragover', (e: DragEvent) => {
    e.preventDefault()
  })
}

async function insertMultipleImagesWithUpload(
  quill: Quill,
  files: File[],
  startIndex: number,
): Promise<void> {
  const placeholderText = `Uploading ${files.length} image${files.length > 1 ? 's' : ''}...`
  quill.insertText(startIndex, placeholderText, { italic: true })
  quill.setSelection(startIndex + placeholderText.length, 0)

  const uploadPromises = files.map(file => uploadImageToS3(file).catch(() => null))
  const urls = await Promise.all(uploadPromises)

  quill.deleteText(startIndex, placeholderText.length)

  const successfulUrls = urls.filter((url): url is string => url !== null)
  const failedCount = urls.length - successfulUrls.length

  for (let i = 0; i < successfulUrls.length; i++) {
    quill.insertEmbed(startIndex + i, 'image', successfulUrls[i])
  }

  if (successfulUrls.length > 0) {
    quill.setSelection(startIndex + successfulUrls.length, 0)
  }

  if (failedCount > 0) {
    alert(`${failedCount} image${failedCount > 1 ? 's' : ''} failed to upload`)
  }
}

async function insertImageWithUpload(
  quill: Quill,
  file: File,
  index: number,
): Promise<void> {
  const placeholderText = 'Uploading image...'
  quill.insertText(index, placeholderText, { italic: true })
  quill.setSelection(index + placeholderText.length, 0)

  try {
    const url = await uploadImageToS3(file)
    quill.deleteText(index, placeholderText.length)
    quill.insertEmbed(index, 'image', url)
    quill.setSelection(index + 1, 0)
  } catch (error) {
    quill.deleteText(index, placeholderText.length)
    const message = error instanceof Error ? error.message : 'Failed to upload image'
    alert(message)
  }
}
