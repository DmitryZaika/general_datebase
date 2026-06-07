import OpenAI from 'openai'
import { toFile } from 'openai/uploads'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { db } from '~/db.server'
import { selectMany } from '~/utils/queryHelpers'
import { downloadFileAsBuffer } from '~/utils/s3.server'

interface DownloadedFile {
  buffer: Buffer
  contentType: string
  filename: string
}

async function fetchFileBuffer(url: string): Promise<DownloadedFile | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const arrayBuffer = await response.arrayBuffer()
    const filenameFromUrl = url.split('?')[0].split('/').pop() ?? 'file'
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: response.headers.get('content-type') ?? 'application/octet-stream',
      filename: filenameFromUrl,
    }
  } catch {
    return null
  }
}

async function downloadAnyFile(url: string): Promise<DownloadedFile | null> {
  const fetched = await fetchFileBuffer(url)
  if (fetched && fetched.buffer.length > 0) return fetched
  return downloadFileAsBuffer(url)
}

const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_SECRET_KEY,
})

const MAX_FILE_CHARS = 6000
const MAX_FILES = 6
const MAX_TOTAL_FILES = 10
const MAX_FALLBACK_FILES_PER_SUPPLIER = 5
const MAX_CONTEXT_CHARS = 24000
const MAX_VISION_FILES = 3

const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'to',
  'of',
  'in',
  'on',
  'at',
  'by',
  'for',
  'with',
  'about',
  'into',
  'from',
  'as',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'do',
  'does',
  'did',
  'can',
  'could',
  'would',
  'should',
  'will',
  'have',
  'has',
  'had',
  'how',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'i',
  'me',
  'my',
  'we',
  'us',
  'our',
  'you',
  'your',
  'it',
  'its',
  'this',
  'that',
  'these',
  'those',
  'please',
  'tell',
  'show',
  'give',
  'get',
  'want',
  'need',
  'know',
  'info',
  'information',
  'price',
  'cost',
  'much',
  'per',
  'sqft',
])

interface SupplierRow {
  id: number
  supplier_name: string
}

interface SupplierFileRow {
  id: number
  supplier_id: number
  name: string
  url: string
}

export interface SupplierSource {
  id: number
  name: string
  supplierName: string
  url: string
  fileType: 'pdf' | 'image' | 'file'
}

export interface SupplierPriceListResult {
  context: string
  sources: SupplierSource[]
}

export type PriceListProgress =
  | { state: 'searching' }
  | { state: 'reading'; fileType: 'pdf' | 'image' | 'file'; name: string }

function queryTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\W+/)
    .filter(term => term.length >= 2 && !STOP_WORDS.has(term))
}

function countMatchingTerms(terms: string[], haystack: string): number {
  if (!haystack) return 0
  const lower = haystack.toLowerCase()
  let count = 0
  for (const term of terms) {
    if (lower.includes(term)) count += 1
  }
  return count
}

function truncateText(text: string, maxChars: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= maxChars) return trimmed
  return `${trimmed.slice(0, maxChars)}\n...[truncated]`
}

function fileExtension(filename: string, url: string): string {
  const source = filename || url
  const match = source.toLowerCase().match(/\.([a-z0-9]+)(?:\?|$)/)
  return match?.[1] ?? ''
}

function isImageExtension(ext: string): boolean {
  return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff'].includes(ext)
}

function isTextExtension(ext: string): boolean {
  return ['txt', 'csv', 'tsv'].includes(ext)
}

function isPdfBuffer(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer.subarray(0, 4).toString() === '%PDF'
}

function isPdfFile(ext: string, contentType: string, buffer: Buffer): boolean {
  return ext === 'pdf' || contentType === 'application/pdf' || isPdfBuffer(buffer)
}

function pdfFileName(filename: string): string {
  return filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`
}

function findMatchingSuppliers(suppliers: SupplierRow[], query: string): SupplierRow[] {
  const terms = queryTerms(query)
  if (terms.length === 0) return []

  const scored = suppliers
    .map(supplier => ({
      supplier,
      score: countMatchingTerms(terms, supplier.supplier_name),
    }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)

  if (scored.length === 0) return []

  const topScore = scored[0].score
  return scored.filter(item => item.score === topScore).map(item => item.supplier)
}

function scoreFileForPriceQuery(file: SupplierFileRow): number {
  const label = `${file.name} ${file.url}`.toLowerCase()
  let score = 0
  if (/\.pdf(?:\?|$)|\/pdf/i.test(label) || /\bpdf\b/.test(label)) score += 10
  if (/price|pricing|list|rate|level|group/i.test(label)) score += 5
  if (/\.(jpg|jpeg|png|webp|gif|bmp|tiff)(?:\?|$)/i.test(label)) score -= 3
  return score
}

function prioritizeFilesForPriceQuery(files: SupplierFileRow[]): SupplierFileRow[] {
  return [...files].sort(
    (a, b) => scoreFileForPriceQuery(b) - scoreFileForPriceQuery(a),
  )
}

function contentHasProductMatch(content: string, terms: string[]): boolean {
  if (terms.length === 0) return false
  const lower = content.toLowerCase()
  const matched = terms.filter(term => lower.includes(term)).length
  const required = Math.max(1, Math.ceil(terms.length * 0.5))
  return matched >= required
}

function contentHasDollarPrice(content: string): boolean {
  return /\$\s*[\d,]+(?:\.\d{2})?|[\d,]+(?:\.\d{2})?\s*(?:\/|per)\s*(?:sq\.?\s*ft|sf|square\s*foot)/i.test(
    content,
  )
}

function needsSupplierFallback(extracted: string, terms: string[]): boolean {
  if (!extracted.trim()) return false
  if (!contentHasProductMatch(extracted, terms)) return false
  return !contentHasDollarPrice(extracted)
}

function findRelevantFiles(
  files: SupplierFileRow[],
  supplierIds: number[],
  query: string,
): SupplierFileRow[] {
  const terms = queryTerms(query)
  const supplierSet = new Set(supplierIds)
  const pool =
    supplierIds.length > 0
      ? files.filter(file => supplierSet.has(file.supplier_id))
      : files

  if (pool.length === 0) return []

  const scored = pool
    .map(file => ({
      file,
      score: countMatchingTerms(terms, `${file.name} ${file.url}`),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return scoreFileForPriceQuery(b.file) - scoreFileForPriceQuery(a.file)
    })

  const topScore = scored[0]?.score ?? 0
  const matched =
    topScore > 0
      ? scored.filter(item => item.score === topScore).map(item => item.file)
      : prioritizeFilesForPriceQuery(pool)

  return matched.slice(0, MAX_FILES)
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  })
  const pdf = await loadingTask.promise
  const parts: string[] = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const pageText = content.items
      .map(item => {
        if (item && typeof item === 'object' && 'str' in item) {
          const value = item.str
          return typeof value === 'string' ? value : ''
        }
        return ''
      })
      .join(' ')
    if (pageText.trim()) {
      parts.push(pageText)
    }
  }

  return parts.join('\n')
}

const PDF_EXTRACT_PROMPT =
  'Read this supplier price list PDF and extract information to answer the question. Include exact dollar prices only if they appear in the document. Also extract the color group or level number, product name, and slab size if shown. If no dollar price is listed for the product, explicitly say that no price is specified and report the level or group and size instead.'

const INLINE_PDF_LIMIT = 4 * 1024 * 1024
const MAX_PDF_UPLOAD = 32 * 1024 * 1024

async function extractPdfInline(
  buffer: Buffer,
  filename: string,
  query: string,
): Promise<string | null> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4.1-mini-2025-04-14',
    temperature: 0,
    max_tokens: 1200,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: `${PDF_EXTRACT_PROMPT} Question: ${query}` },
          {
            type: 'file',
            file: {
              filename: pdfFileName(filename),
              file_data: `data:application/pdf;base64,${buffer.toString('base64')}`,
            },
          },
        ],
      },
    ],
  })
  return response.choices[0]?.message?.content?.trim() ?? null
}

async function extractPdfViaUpload(
  buffer: Buffer,
  filename: string,
  query: string,
): Promise<string | null> {
  const uploaded = await openai.files.create({
    file: await toFile(buffer, pdfFileName(filename), {
      type: 'application/pdf',
    }),
    purpose: 'user_data',
  })

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini-2025-04-14',
      temperature: 0,
      max_tokens: 1200,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: `${PDF_EXTRACT_PROMPT} Question: ${query}` },
            { type: 'file', file: { file_id: uploaded.id } },
          ],
        },
      ],
    })
    return response.choices[0]?.message?.content?.trim() ?? null
  } finally {
    try {
      await openai.files.delete(uploaded.id)
    } catch {
      // best effort cleanup
    }
  }
}

async function extractPdfWithOpenAI(
  buffer: Buffer,
  filename: string,
  query: string,
): Promise<string | null> {
  if (buffer.length > MAX_PDF_UPLOAD) return null

  try {
    if (buffer.length <= INLINE_PDF_LIMIT) {
      return await extractPdfInline(buffer, filename, query)
    }
    return await extractPdfViaUpload(buffer, filename, query)
  } catch {
    return null
  }
}

async function extractImageText(url: string, query: string): Promise<string | null> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini-2025-04-14',
      temperature: 0,
      max_tokens: 800,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Extract information from this supplier price list image to answer the question. Include exact dollar prices only if they appear in the document. Also extract the color group or level number, product name, and slab size if shown. If no dollar price is listed for the product, explicitly say that no price is specified and report the level or group and size instead. Question: ${query}`,
            },
            {
              type: 'image_url',
              image_url: { url },
            },
          ],
        },
      ],
    })
    return response.choices[0]?.message?.content?.trim() ?? null
  } catch {
    return null
  }
}

async function extractSupplierFileText(
  file: SupplierFileRow,
  query: string,
): Promise<string | null> {
  const downloaded = await downloadAnyFile(file.url)
  if (!downloaded) return null

  const ext = fileExtension(downloaded.filename, file.url)
  const { buffer, contentType } = downloaded

  if (isTextExtension(ext) || contentType.startsWith('text/')) {
    return truncateText(buffer.toString('utf8'), MAX_FILE_CHARS)
  }

  if (isPdfFile(ext, contentType, buffer)) {
    let text = ''
    try {
      text = await extractPdfText(buffer)
    } catch {
      text = ''
    }

    if (text.trim()) {
      return truncateText(text, MAX_FILE_CHARS)
    }

    const openAiText = await extractPdfWithOpenAI(buffer, downloaded.filename, query)
    if (openAiText) {
      return truncateText(openAiText, MAX_FILE_CHARS)
    }

    return null
  }

  if (isImageExtension(ext) || contentType.startsWith('image/')) {
    const text = await extractImageText(file.url, query)
    return text ? truncateText(text, MAX_FILE_CHARS) : null
  }

  return null
}

export async function buildSupplierPriceListContext(
  companyId: number,
  query: string,
  onProgress?: (progress: PriceListProgress) => void,
): Promise<SupplierPriceListResult> {
  onProgress?.({ state: 'searching' })

  const suppliers = await selectMany<SupplierRow>(
    db,
    'SELECT id, supplier_name FROM suppliers WHERE company_id = ?',
    [companyId],
  )

  if (suppliers.length === 0) {
    return { context: '', sources: [] }
  }

  const supplierIds = suppliers.map(supplier => supplier.id)
  const files = await selectMany<SupplierFileRow>(
    db,
    'SELECT id, supplier_id, name, url FROM supplier_files WHERE supplier_id IN (?)',
    [supplierIds],
  )

  if (files.length === 0) {
    return {
      context: 'SUPPLIER PRICE LISTS\nNo supplier files are uploaded for this company.',
      sources: [],
    }
  }

  const matchedSuppliers = findMatchingSuppliers(suppliers, query)
  const matchedSupplierIds = matchedSuppliers.map(supplier => supplier.id)
  const relevantFiles = findRelevantFiles(files, matchedSupplierIds, query)

  const terms = queryTerms(query)

  const sections: string[] = [
    'SUPPLIER PRICE LISTS',
    'Answer using ONLY the supplier documents below. These are PDF files and images uploaded on the Suppliers page.',
    'Only report dollar prices that explicitly appear in the documents. Never invent or estimate prices.',
    'When one document from a supplier shows a product with a color group or level and size but no dollar price, check every other SOURCE from that same supplier for the actual price before saying the price is not specified.',
    'Only after checking all documents from that supplier should you say the price is not specified and give the level or group and size.',
    'If the requested color name is close but not exact (for example "Adonia" vs "Calacatta Adonia"), give the price for the closest matching product from that supplier. Say the name was not an exact match, give the exact document name, then state the price and size.',
    'Only say the product could not be found when there is no reasonable close match in the documents from that supplier.',
    'Be brief. Include exact prices only when they are written in the document.',
    'Each readable document below is labeled with a SOURCE number. Track which document your answer comes from so it can be cited.',
  ]

  const sources: SupplierSource[] = []
  let visionCalls = 0
  const readFileIds = new Set<number>()
  const fileQueue: SupplierFileRow[] = [...relevantFiles]
  const queuedFileIds = new Set(relevantFiles.map(file => file.id))
  const fallbackCounts = new Map<number, number>()

  const enqueueSupplierFallback = (supplierId: number) => {
    const added = fallbackCounts.get(supplierId) ?? 0
    if (added >= MAX_FALLBACK_FILES_PER_SUPPLIER) return

    const sameSupplierFiles = prioritizeFilesForPriceQuery(
      files.filter(
        file =>
          file.supplier_id === supplierId &&
          !readFileIds.has(file.id) &&
          !queuedFileIds.has(file.id),
      ),
    )

    let enqueued = 0
    for (const file of sameSupplierFiles) {
      if (added + enqueued >= MAX_FALLBACK_FILES_PER_SUPPLIER) break
      fileQueue.push(file)
      queuedFileIds.add(file.id)
      enqueued += 1
    }
    if (enqueued > 0) {
      fallbackCounts.set(supplierId, added + enqueued)
    }
  }

  while (fileQueue.length > 0 && readFileIds.size < MAX_TOTAL_FILES) {
    const file = fileQueue.shift()
    if (!file || readFileIds.has(file.id)) continue
    readFileIds.add(file.id)

    const supplier = suppliers.find(item => item.id === file.supplier_id)
    const supplierName = supplier?.supplier_name ?? 'Unknown supplier'
    const ext = fileExtension(file.name, file.url)
    const isImage =
      isImageExtension(ext) || file.url.match(/\.(jpg|jpeg|png|webp|gif)/i)
    const isPdf =
      ext === 'pdf' || /\.pdf(?:\?|$)/i.test(file.url) || /pdf/i.test(file.name)
    const fileType: SupplierSource['fileType'] = isPdf
      ? 'pdf'
      : isImage
        ? 'image'
        : 'file'

    if (isImage && visionCalls >= MAX_VISION_FILES) {
      sections.push(`\nFILE: ${file.name} (${supplierName})`)
      sections.push('CONTENT: Skipped additional image files to limit processing.')
      continue
    }
    if (isImage) {
      visionCalls += 1
    }

    onProgress?.({
      state: 'reading',
      fileType: isPdf ? 'pdf' : isImage ? 'image' : 'file',
      name: file.name,
    })

    const extracted = await extractSupplierFileText(file, query)
    if (extracted) {
      const sourceId = sources.length + 1
      sources.push({
        id: sourceId,
        name: file.name,
        supplierName,
        url: file.url,
        fileType,
      })
      sections.push(`\nSOURCE ${sourceId} — FILE: ${file.name} (${supplierName})`)
      sections.push(`CONTENT:\n${extracted}`)

      if (needsSupplierFallback(extracted, terms)) {
        enqueueSupplierFallback(file.supplier_id)
      }
    } else {
      sections.push(`\nFILE: ${file.name} (${supplierName})`)
      if (isImage) {
        sections.push('CONTENT: Could not read this image file.')
      } else if (isPdf) {
        sections.push('CONTENT: Could not read this PDF file.')
      } else {
        sections.push('CONTENT: Could not extract readable text from this file.')
      }
    }
  }

  return {
    context: truncateText(sections.join('\n'), MAX_CONTEXT_CHARS),
    sources,
  }
}
