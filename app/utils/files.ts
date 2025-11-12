import { fileTypeFromBuffer } from 'file-type'
import mime from 'mime-types'
import sharp from 'sharp'

// --- Белый список и утилиты ---

export const ALLOWED_IMAGE_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg', // нормализуем к image/jpeg
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/tiff',
  'image/bmp',
  'image/x-icon',
  'image/heif',
  'image/x-canon-cr2',
  'image/x-nikon-nef',
])

export function normalizeMime(m: string | false | null | undefined) {
  if (!m) return null
  if (m === 'image/jpg') return 'image/jpeg'
  return m
}

// Примитивная проверка SVG, если file-type не сработал
function looksLikeSvg(buf: Buffer) {
  const str = buf.slice(0, 2000).toString('utf8').trimStart()
  return /^<\?xml[^>]*>\s*<svg[\s>]/i.test(str) || /^<svg[\s>]/i.test(str)
}

// Формирует имя c суффиксом -icon перед расширением
export function withIconSuffix(name: string) {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? `${name}-icon` : `${name.slice(0, dot)}-icon${name.slice(dot)}`
}

// Пытаемся определить MIME по (1) заголовку, (2) file-type, (3) SVG-хаку, (4) расширению
export async function detectMime(
  buffer: Buffer,
  headerMime: string | null,
  filename: string,
) {
  const byHeader = normalizeMime(headerMime)
  if (byHeader && byHeader !== 'application/octet-stream') {
    return byHeader
  }
  const ft = await fileTypeFromBuffer(buffer)
  if (ft?.mime) return normalizeMime(ft.mime)

  if (looksLikeSvg(buffer)) return 'image/svg+xml'

  // Фолбэк по расширению
  const byExt = normalizeMime(mime.lookup(filename) || null)
  return byExt
}

export async function compressImage(original: Buffer<ArrayBufferLike>) {
  return await sharp(original).rotate().resize(480, 320, { fit: 'fill' }).toBuffer()
}
