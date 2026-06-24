import type { IncomingMessage } from 'node:http'
import { PassThrough, Readable } from 'node:stream'
import {
  DeleteObjectCommand,
  GetObjectCommand,
  type PutObjectCommandInput,
  S3,
  S3ServiceException,
  waitUntilObjectNotExists,
} from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import type { FileUpload } from '@mjackson/form-data-parser'
import { writeAsyncIterableToWritable } from '@react-router/node'
import mime from 'mime-types'
import { v4 as uuidv4 } from 'uuid'
import {
  ALLOWED_IMAGE_MIME,
  detectMime,
  normalizeMime,
  withIconSuffix,
} from '~/utils/files'
import { compressImage } from './files.server'

const { STORAGE_ACCESS_KEY, STORAGE_SECRET, STORAGE_REGION, STORAGE_BUCKET } =
  process.env

if (!(STORAGE_ACCESS_KEY && STORAGE_SECRET && STORAGE_REGION && STORAGE_BUCKET)) {
  throw new Error(`Storage is missing required configuration.`)
}

function bufferToAsyncIterable(buffer: Buffer) {
  return {
    async *[Symbol.asyncIterator]() {
      yield buffer
    },
  }
}

const getClient = () => {
  return new S3({
    credentials: {
      accessKeyId: STORAGE_ACCESS_KEY,
      secretAccessKey: STORAGE_SECRET,
    },
    region: STORAGE_REGION,
  })
}

export const deleteFile = async (url: string) => {
  const finalKey = url.replace(
    `https://${STORAGE_BUCKET}.s3.${STORAGE_REGION}.amazonaws.com/`,
    '',
  )
  const client = getClient()
  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: STORAGE_BUCKET,
        Key: finalKey,
      }),
    )
    await waitUntilObjectNotExists(
      { client, maxWaitTime: 30 },
      { Bucket: STORAGE_BUCKET, Key: finalKey },
    )
  } catch (caught) {
    if (caught instanceof S3ServiceException && caught.name === 'NoSuchBucket') {
      // biome-ignore lint/suspicious/noConsole: for tests
      console.error(
        `Error from S3 while deleting object from ${STORAGE_BUCKET}. The bucket doesn't exist.`,
      )
    } else if (caught instanceof S3ServiceException) {
      // biome-ignore lint/suspicious/noConsole: for tests
      console.error(
        `Error from S3 while deleting object from ${STORAGE_BUCKET}.  ${caught.name}: ${caught.message}`,
      )
    } else {
      throw caught
    }
  }
}

const uploadStream = ({
  Key,
  ContentType,
}: Pick<PutObjectCommandInput, 'Key' | 'ContentType'>) => {
  const s3 = getClient()
  const pass = new PassThrough()
  return {
    writeStream: pass,
    promise: new Upload({
      client: s3,

      params: {
        Bucket: STORAGE_BUCKET,
        Key,
        Body: pass,
        ContentDisposition: 'inline',
        ContentType: ContentType || 'application/octet-stream',
      },
    }).done(),
  }
}

export async function uploadStreamToS3(
  data: AsyncIterable<Uint8Array>,
  filename: string,
  folder: string = 'dynamic-images',
) {
  const mimeType = mime.lookup(filename) || 'application/octet-stream'
  const stream = uploadStream({
    Key: `${folder}/${filename}`,
    ContentType: mimeType,
  })
  await writeAsyncIterableToWritable(data, stream.writeStream)
  const file = await stream.promise
  return file.Location
}

export async function uploadToSpecificBucket(
  data: AsyncIterable<Uint8Array>,
  filename: string,
  bucket: string,
  folder: string = '',
) {
  const s3 = getClient()
  const pass = new PassThrough()
  const mimeType = mime.lookup(filename) || 'application/octet-stream'
  const key = folder ? `${folder}/${filename}` : filename

  const upload = new Upload({
    client: s3,
    params: {
      Bucket: bucket,
      Key: key,
      Body: pass,
      ContentDisposition: 'inline',
      ContentType: mimeType,
    },
  })

  await writeAsyncIterableToWritable(data, pass)
  const file = await upload.done()
  return file.Location
}

export const s3UploadHandler = async (
  fileUpload: FileUpload,
  folder: string,
): Promise<string | null | undefined> => {
  if (fileUpload.fieldName !== 'file') return null

  // читаем все байты один раз
  const bytes = await fileUpload.arrayBuffer()
  const buffer = Buffer.from(bytes)

  // исходное имя клиента
  const originalClientName = fileUpload.name || 'upload.bin'

  // делаем детекцию MIME
  const headerMime = fileUpload.type ?? null // если парсер даёт тип, иначе null
  const detectedMime = await detectMime(buffer, headerMime, originalClientName)

  // определяем расширение для записи в S3
  // (если расширения нет — возьмём по mime, иначе — оставим клиентское)
  const extFromName = (originalClientName.match(/\.[^.]+$/)?.[0] ?? '').toLowerCase()
  const extFromMime = detectedMime
    ? `.${mime.extension(detectedMime) || 'bin'}`
    : extFromName || '.bin'
  const ext = extFromName || extFromMime

  const base = uuidv4()
  const finalname = `${folder}/${base}${ext}`
  const iconName = withIconSuffix(finalname)

  const originalUrl = await uploadStreamToS3(bufferToAsyncIterable(buffer), finalname)

  // Решаем, делать ли иконку
  const normalized = normalizeMime(detectedMime)
  const isAllowed = normalized ? ALLOWED_IMAGE_MIME.has(normalized) : false

  if (!isAllowed) {
    return originalUrl
  }

  // Пытаемся сделать иконку через sharp; если не получится — не падаем, просто вернём оригинал
  try {
    const iconBuffer = await compressImage(buffer)

    await uploadStreamToS3(bufferToAsyncIterable(iconBuffer), iconName)
    return originalUrl
  } catch {
    // console.warn(`Icon generation failed for ${normalized}: ${(err as Error).message}`)
    return originalUrl
  }
}

export const downloadPDF = async (url: string) => {
  const finalKey = url.replace(
    `https://${STORAGE_BUCKET}.s3.${STORAGE_REGION}.amazonaws.com/`,
    '',
  )
  const client = getClient()
  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: STORAGE_BUCKET,
        Key: finalKey,
      }),
    )

    // Check if the file is a PDF
    const contentType = response.ContentType
    if (contentType !== 'application/pdf') {
      throw new Error('The requested file is not a PDF')
    }

    if (!(response.Body instanceof Readable)) {
      throw new Error('The requested file is not a PDF')
    }

    return {
      stream: response.Body as IncomingMessage | Readable,
      contentType: contentType,
      contentLength: response.ContentLength,
      filename: finalKey.split('/').pop(),
    }
  } catch (caught) {
    if (caught instanceof S3ServiceException && caught.name === 'NoSuchBucket') {
      // biome-ignore lint/suspicious/noConsole: for tests
      console.error(
        `Error from S3 while downloading PDF from ${STORAGE_BUCKET}. The bucket doesn't exist.`,
      )
    } else if (caught instanceof S3ServiceException) {
      // biome-ignore lint/suspicious/noConsole: for tests
      console.error(
        `Error from S3 while downloading PDF from ${STORAGE_BUCKET}. ${caught.name}: ${caught.message}`,
      )
    }
    throw caught
  }
}

// Helper function to get PDF as a buffer directly
export async function downloadFileAsBuffer(url: string) {
  const finalKey = url.replace(
    `https://${STORAGE_BUCKET}.s3.${STORAGE_REGION}.amazonaws.com/`,
    '',
  )
  const client = getClient()
  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: STORAGE_BUCKET,
        Key: finalKey,
      }),
    )

    if (!(response.Body instanceof Readable)) {
      return null
    }

    const chunks: Uint8Array[] = []
    for await (const chunk of response.Body) {
      chunks.push(chunk)
    }

    return {
      buffer: Buffer.concat(chunks),
      contentType: response.ContentType ?? 'application/octet-stream',
      filename: finalKey.split('/').pop() ?? 'file',
    }
  } catch {
    return null
  }
}

function parseS3Uri(input: string) {
  if (!input.startsWith('s3://')) return null
  const withoutScheme = input.slice('s3://'.length)
  const firstSlash = withoutScheme.indexOf('/')
  if (firstSlash <= 0) return null
  const bucket = withoutScheme.slice(0, firstSlash)
  const key = withoutScheme.slice(firstSlash + 1)
  if (!bucket || !key) return null
  return { bucket, key }
}

function resolveS3Object(url: string): { bucket: string; key: string } | null {
  const s3Uri = parseS3Uri(url)
  if (s3Uri) return s3Uri

  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    const path = parsed.pathname.replace(/^\/+/, '')
    if (!path) return null

    const vhostMatch = host.match(
      /^(.+)\.s3[.-][a-z0-9-]+\.amazonaws\.com$|^(.+)\.s3\.amazonaws\.com$/,
    )
    if (vhostMatch) {
      const bucket = vhostMatch[1] || vhostMatch[2]
      if (bucket) return { bucket, key: path }
    }

    if (host.startsWith('s3.') && host.endsWith('.amazonaws.com')) {
      const [bucket, ...rest] = path.split('/')
      if (bucket && rest.length > 0) return { bucket, key: rest.join('/') }
    }

    if (STORAGE_BUCKET && host.includes(STORAGE_BUCKET)) {
      return { bucket: STORAGE_BUCKET, key: path }
    }

    const legacyKey = url.replace(
      `https://${STORAGE_BUCKET}.s3.${STORAGE_REGION}.amazonaws.com/`,
      '',
    )
    if (legacyKey !== url && legacyKey && STORAGE_BUCKET) {
      return { bucket: STORAGE_BUCKET, key: legacyKey }
    }
  } catch {
    return null
  }

  return null
}

async function downloadS3Object(bucket: string, key: string) {
  const client = getClient()
  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  )
  if (!(response.Body instanceof Readable)) return null
  const chunks: Uint8Array[] = []
  for await (const chunk of response.Body) {
    chunks.push(chunk)
  }
  return {
    buffer: Buffer.concat(chunks),
    contentType: response.ContentType ?? 'application/octet-stream',
    filename: key.split('/').pop() ?? 'file',
  }
}

export async function downloadObjectAsBuffer(url: string) {
  const resolved = resolveS3Object(url)
  if (resolved) {
    try {
      return await downloadS3Object(resolved.bucket, resolved.key)
    } catch {
      return null
    }
  }
  return downloadFileAsBuffer(url)
}

export const downloadPDFAsBuffer = async (url: string) => {
  const pdfData = await downloadPDF(url)
  if (!pdfData?.stream) {
    return null
  }
  // Convert the stream to a buffer
  const chunks: Uint8Array[] = []
  for await (const chunk of pdfData.stream) {
    chunks.push(chunk)
  }

  return {
    buffer: Buffer.concat(chunks),
    contentType: pdfData.contentType,
    contentLength: pdfData.contentLength,
    filename: pdfData.filename,
  }
}
