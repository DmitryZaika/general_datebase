import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const { STORAGE_ACCESS_KEY, STORAGE_SECRET, STORAGE_REGION } = process.env

if (!(STORAGE_ACCESS_KEY && STORAGE_SECRET && STORAGE_REGION)) {
  throw new Error('Storage is missing required configuration.')
}

const client = new S3Client({
  credentials: {
    accessKeyId: STORAGE_ACCESS_KEY,
    secretAccessKey: STORAGE_SECRET,
  },
  region: STORAGE_REGION,
})

function getClient() {
  return client
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

export async function presignIfS3Uri(
  url: string,
  expiresInSeconds: number = 3600,
  contentDisposition: 'inline' | 'attachment' | null = null,
  contentType: string | null = null,
) {
  const parsed = parseS3Uri(url)
  if (!parsed) return url
  const client = getClient()
  const command = new GetObjectCommand({
    Bucket: parsed.bucket,
    Key: parsed.key,
    ResponseContentDisposition: contentDisposition,
    ResponseContentType: contentType,
  })
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds })
}
