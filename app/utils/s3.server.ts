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
import { PassThrough } from 'stream'
import { v4 as uuidv4 } from 'uuid'

const { STORAGE_ACCESS_KEY, STORAGE_SECRET, STORAGE_REGION, STORAGE_BUCKET } =
  process.env

if (!(STORAGE_ACCESS_KEY && STORAGE_SECRET && STORAGE_REGION && STORAGE_BUCKET)) {
  throw new Error(`Storage is missing required configuration.`)
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

function readableStreamToAsyncIterable(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader()

  return {
    async *[Symbol.asyncIterator]() {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            break
          }
          yield value
        }
      } finally {
        reader.releaseLock()
      }
    },
  }
}

export async function uploadStreamToS3(
  data: AsyncIterable<Uint8Array>,
  filename: string,
) {
  const mimeType = mime.lookup(filename) || 'application/octet-stream'
  const stream = uploadStream({
    Key: `dynamic-images/${filename}`,
    ContentType: mimeType,
  })
  await writeAsyncIterableToWritable(data, stream.writeStream)
  const file = await stream.promise
  return file.Location
}

export const s3UploadHandler = async (
  fileUpload: FileUpload,
  folder: string,
): Promise<File | string | null | undefined> => {
  if (fileUpload.fieldName === 'file') {
    const extensionRegex = /(?:\.([^.]+))?$/
    const extension = extensionRegex.exec(fileUpload.name)
    const finalname = `${folder}/${uuidv4()}.${extension?.[1]}`

    const asyncIterable = readableStreamToAsyncIterable(fileUpload.stream())

    const uploadedFileLocation = await uploadStreamToS3(asyncIterable, finalname)
    return uploadedFileLocation
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

    // Return the PDF data stream
    return {
      stream: response.Body,
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
export const downloadPDFAsBuffer = async (url: string) => {
  const pdfData = await downloadPDF(url)

  // Convert the stream to a buffer
  const chunks: Uint8Array[] = []
  // @ts-ignore - AWS SDK stream types
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
