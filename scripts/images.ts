import { Readable } from 'node:stream' // Импортируем для проверки типов
import {
  GetObjectCommand,
  type GetObjectCommandOutput,
  ListObjectsV2Command,
  type ListObjectsV2CommandOutput,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import dotenv from 'dotenv'
import type { RowDataPacket } from 'mysql2'
import mysql from 'mysql2/promise'
import { withIconSuffix } from '~/utils/files'
import { compressImage } from '~/utils/files.server'
import { posthogClient } from '~/utils/posthog.server'

dotenv.config()

/** Вспомогалка: ReadableStream/Blob → Buffer (Node) */
// Мы берем тип Body прямо из ответа команды S3
async function bodyToBuffer(body: GetObjectCommandOutput['Body']): Promise<Buffer> {
  if (!body) {
    return Buffer.from([])
  }

  // Проверка: это Node.js Readable stream?
  if (body instanceof Readable) {
    const chunks: Buffer[] = []
    for await (const chunk of body) {
      chunks.push(Buffer.from(chunk))
    }
    return Buffer.concat(chunks)
  }

  // Проверка: это Web Blob/File? (если вдруг используется полифил)
  // Используем проверку наличия метода, но типизируем безопаснее
  if ('arrayBuffer' in body && typeof body.arrayBuffer === 'function') {
    const ab = await body.arrayBuffer()
    return Buffer.from(ab)
  }

  // Если это уже Uint8Array или Buffer (в некоторых версиях SDK)
  if (body instanceof Uint8Array) {
    return Buffer.from(body)
  }

  throw new Error('Unsupported S3 Body type')
}

// ──────────────────────────── DB CONNECTION ────────────────────────────────
const db = await mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
})

// ──────────────────────────── ENV VALIDATION ───────────────────────────────
function req(name: string): string {
  const v = process.env[name]?.trim()
  if (!v) throw new Error(`Missing required env var: ${name}`)
  return v
}

const STORAGE_REGION = req('STORAGE_REGION')
const STORAGE_BUCKET = req('STORAGE_BUCKET')
const STORAGE_ACCESS_KEY = req('STORAGE_ACCESS_KEY')
const STORAGE_SECRET = req('STORAGE_SECRET')

// ──────────────────────────── S3 CLIENT ────────────────────────────────────
const s3 = new S3Client({
  region: STORAGE_REGION,
  credentials: {
    accessKeyId: STORAGE_ACCESS_KEY,
    secretAccessKey: STORAGE_SECRET,
  },
})

// ──────────────────────────── HELPERS ──────────────────────────────────────
function encodeKeyForUrl(key: string): string {
  return key
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/')
}

function toS3HttpsUrl(bucket: string, region: string, key: string): string {
  const encodedKey = encodeKeyForUrl(key)
  return `https://${bucket}.s3.${region}.amazonaws.com/${encodedKey}`
}

export async function processAndUploadImage(
  srcKey: string,
  destKey: string,
): Promise<void> {
  // 1) Скачать исходник
  // Явно указываем, что ожидаем output от GetObjectCommand
  const got: GetObjectCommandOutput = await s3.send(
    new GetObjectCommand({
      Bucket: STORAGE_BUCKET,
      Key: srcKey,
    }),
  )

  const buffer = await bodyToBuffer(got.Body)

  // 2) Сделать уменьшенную копию
  const iconBuffer = await compressImage(buffer)

  // 3) Залить в S3
  await s3.send(
    new PutObjectCommand({
      Bucket: STORAGE_BUCKET,
      Key: destKey,
      Body: iconBuffer,
      ContentType: got.ContentType ?? 'image/jpeg', // TS теперь знает про ContentType
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )
}

// ──────────────────────────── LIST FILES FUNCTION ──────────────────────────
async function listAllStoneImages(): Promise<string[]> {
  const prefix = 'dynamic-images/stones/'
  const urls: string[] = []

  let token: string | undefined

  while (true) {
    const response: ListObjectsV2CommandOutput = await s3.send(
      new ListObjectsV2Command({
        Bucket: STORAGE_BUCKET,
        Prefix: prefix,
        ContinuationToken: token,
        MaxKeys: 1000,
      }),
    )

    response.Contents?.forEach(obj => {
      const key = obj.Key
      if (key && !key.endsWith('/')) {
        urls.push(toS3HttpsUrl(STORAGE_BUCKET, STORAGE_REGION, key))
      }
    })

    if (!response.IsTruncated) break
    token = response.NextContinuationToken
  }

  return urls
}

// ──────────────────────────── MAIN ─────────────────────────────────────────
async function main() {
  const [rows] = await db.query<{ url: string }[] & RowDataPacket[]>(
    'SELECT url FROM stones',
  )
  const dbUrls = rows.map(row => row.url)

  const files = await listAllStoneImages()

  // Создаем Set для быстрого поиска (оптимизация, необязательно, но полезно)
  const filesSet = new Set(files)

  const missingFiles = dbUrls.filter(file => !filesSet.has(withIconSuffix(file)))
  posthogClient.capture({
    event: 'found_missing_icons_to_process',
    properties: {
      count: missingFiles.length,
    },
  })

  const bucketUrlPrefix = `https://${STORAGE_BUCKET}.s3.${STORAGE_REGION}.amazonaws.com/`

  for (const file of missingFiles) {
    const cleanFile = file.replace(bucketUrlPrefix, '')
    try {
      await processAndUploadImage(cleanFile, withIconSuffix(cleanFile))
    } catch (error) {
      posthogClient.captureException(error, 'Failed to process image', {
        file: cleanFile,
      })
    }
  }
}

main()
  .catch(e => {
    posthogClient.captureException(e, 'Fatal error')
    process.exitCode = 1
  })
  .finally(async () => {
    await db.end()
    s3.destroy()
  })
