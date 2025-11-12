import type { ListObjectsV2CommandOutput } from '@aws-sdk/client-s3'
import pkg from '@aws-sdk/client-s3'
import dotenv from 'dotenv'
import type { RowDataPacket } from 'mysql2'
import mysql from 'mysql2/promise'
import { withIconSuffix } from '~/utils/files'
import { compressImage } from '~/utils/files.server'

const { S3Client, ListObjectsV2Command } = pkg

// если не добавлял — достанем команды из pkg (у тебя уже есть ListObjectsV2Command)
const { GetObjectCommand, PutObjectCommand } = pkg as {
  GetObjectCommand: any
  PutObjectCommand: any
}

/** Вспомогалка: ReadableStream/Blob → Buffer (Node) */
async function bodyToBuffer(body: unknown): Promise<Buffer> {
  // Node Readable
  if (body && typeof (body as any).pipe === 'function') {
    const chunks: Buffer[] = []
    for await (const chunk of body as any) chunks.push(Buffer.from(chunk))
    return Buffer.concat(chunks)
  }
  // Blob
  if (body && typeof (body as any).arrayBuffer === 'function') {
    const ab = await (body as any).arrayBuffer()
    return Buffer.from(ab)
  }
  throw new Error('Unsupported S3 Body type')
}

dotenv.config()

// ──────────────────────────── DB CONNECTION ────────────────────────────────
const db = await mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
})

// ──────────────────────────── S3 IMPORTS (CJS RUNTIME + TYPE ONLY) ────────
// Runtime — через default (CJS-модуль)

// ──────────────────────────── ENV VALIDATION ───────────────────────────────
function req(name: string): string {
  const v = process.env[name]?.trim()
  if (!v) throw new Error(`Missing required env var: ${name}`)
  return v
}

const STORAGE_REGION = req('STORAGE_REGION') // напр. "us-east-2"
const STORAGE_BUCKET = req('STORAGE_BUCKET') // напр. "granite-database"
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
/**
 * Безопасно кодируем key в URL, не трогая слеши.
 */
function encodeKeyForUrl(key: string): string {
  return key
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/')
}

/**
 * Формируем полный HTTPS URL в виртуально-хостовом стиле.
 * Пример: https://granite-database.s3.us-east-2.amazonaws.com/dynamic-images/stones/a.jpg
 */
function toS3HttpsUrl(bucket: string, region: string, key: string): string {
  const encodedKey = encodeKeyForUrl(key)
  return `https://${bucket}.s3.${region}.amazonaws.com/${encodedKey}`
}

/**
 * Простейшая функция: взять файл из S3, сделать иконку 240x160, залить по новому ключу
 * @param srcKey  - исходный ключ в бакете, например: "dynamic-images/stones/foo.jpg"
 * @param destKey - ключ-назначение (куда положить), например: "dynamic-images/stones/foo.icon.jpg"
 */
export async function processAndUploadImage(
  srcKey: string,
  destKey: string,
): Promise<void> {
  // 1) скачать исходник
  const got = await s3.send(
    new GetObjectCommand({
      Bucket: STORAGE_BUCKET,
      Key: srcKey,
    }),
  )
  const buffer = await bodyToBuffer(got.Body)

  // 2) сделать уменьшенную копию
  const iconBuffer = await compressImage(buffer)

  // 3) залить в S3 по новому ключу
  await s3.send(
    new PutObjectCommand({
      Bucket: STORAGE_BUCKET,
      Key: destKey,
      Body: iconBuffer,
      // Сохраняем Content-Type, если знаем, иначе JPEG по умолчанию
      ContentType: got.ContentType ?? 'image/jpeg',
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
  console.log(dbUrls.length)

  const files = await listAllStoneImages()
  console.log(files.length)

  const missingFiles = dbUrls.filter(file => !files.includes(withIconSuffix(file)))
  console.log(missingFiles.length)
  for (const file of missingFiles) {
    const cleanFile = file.replace(
      'https://granite-database.s3.us-east-2.amazonaws.com/',
      '',
    )
    try {
      await processAndUploadImage(cleanFile, withIconSuffix(cleanFile))
      console.log(`Processed ${file} to ${withIconSuffix(file)}`)
    } catch (error) {
      console.error(`Error processing ${file}: ${error}`)
    }
  }
}

main()
  .catch(e => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    try {
      await db.end() // закрыть пул
    } catch {}
    try {
      s3.destroy() // закрыть S3 клиент
    } catch {}
  })
