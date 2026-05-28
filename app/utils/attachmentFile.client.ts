export async function urlToFile(imageUrl: string, fileName: string): Promise<File> {
  let blob: Blob
  try {
    const direct = await fetch(imageUrl, { mode: 'cors', credentials: 'omit' })
    if (direct.ok) {
      blob = await direct.blob()
    } else {
      throw new Error(`${direct.status}`)
    }
  } catch {
    const proxy = await fetch('/api/attachment/fetch-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: imageUrl }),
      credentials: 'same-origin',
    })
    if (!proxy.ok) throw new Error(`Failed to load attachment: ${proxy.status}`)
    blob = await proxy.blob()
  }

  const ext = (
    fileName.includes('.') ? (fileName.split('.').pop() ?? '') : ''
  ).toLowerCase()
  const docMime: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }
  const mime =
    blob.type ||
    (docMime[ext] ??
      (ext === 'jpg' || ext === 'jpeg'
        ? 'image/jpeg'
        : ext === 'png'
          ? 'image/png'
          : 'application/octet-stream'))
  return new File([blob], fileName.replace(/[^a-zA-Z0-9.-]/g, '_'), { type: mime })
}
