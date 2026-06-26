import OpenAI from 'openai'
import { toFile } from 'openai/uploads'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { db } from '~/db.server'
import { GPT_MINI_MODEL } from '~/utils/openaiModels'
import { selectMany } from '~/utils/queryHelpers'
import { downloadFileAsBuffer } from '~/utils/s3.server'

interface DownloadedFile {
  buffer: Buffer
  contentType: string
  filename: string
}

const FETCH_TIMEOUT_MS = 30_000
const PDF_TEXT_EXTRACT_TIMEOUT_MS = 45_000
const OPENAI_EXTRACT_TIMEOUT_MS = 180_000

function isS3StorageUrl(url: string): boolean {
  return /\.s3\.[\w-]+\.amazonaws\.com\//i.test(url)
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<undefined>(resolve => {
    timeoutId = setTimeout(() => resolve(undefined), ms)
  })
  try {
    return await Promise.race([promise, timeoutPromise])
  } catch {
    return undefined
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

async function fetchFileBuffer(url: string): Promise<DownloadedFile | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: controller.signal })
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
  } finally {
    clearTimeout(timeoutId)
  }
}

async function downloadAnyFile(url: string): Promise<DownloadedFile | null> {
  if (isS3StorageUrl(url)) {
    return downloadFileAsBuffer(url)
  }
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
  file_text: string | null
}

export interface SupplierFileIndexRow extends SupplierFileRow {
  supplier_name: string
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
  | {
      state: 'reading'
      phase?: 'downloading' | 'extracting'
      fileType: 'pdf' | 'image' | 'file'
      name: string
    }

function queryTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\W+/)
    .filter(term => term.length >= 2 && !STOP_WORDS.has(term))
}

function countMatchingTerms(terms: string[], haystack: string): number {
  if (!haystack) return 0
  let count = 0
  for (const term of terms) {
    if (termMatchesInText(term, haystack)) count += 1
  }
  return count
}

function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  const rows = a.length + 1
  const cols = b.length + 1
  const matrix: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0))
  for (let i = 0; i < rows; i += 1) matrix[i][0] = i
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      )
    }
  }
  return matrix[a.length][b.length]
}

function termMatchesInText(term: string, haystack: string): boolean {
  const lower = haystack.toLowerCase()
  const termLower = term.toLowerCase()
  if (lower.includes(termLower)) return true
  if (term.length < 5) return false

  const maxDist = term.length >= 8 ? 2 : 1
  const words = lower.split(/[^a-z0-9]+/).filter(word => word.length >= 3)
  for (const word of words) {
    if (Math.abs(word.length - term.length) > maxDist) continue
    if (levenshtein(termLower, word) <= maxDist) return true
  }
  return false
}

function findTermMatchIndex(text: string, term: string): number {
  const lower = text.toLowerCase()
  const termLower = term.toLowerCase()
  const exact = lower.indexOf(termLower)
  if (exact !== -1) return exact

  if (term.length < 5) return -1

  const maxDist = term.length >= 8 ? 2 : 1
  let bestIndex = -1
  let bestDist = maxDist + 1
  const pattern = /[a-z0-9]{3,}/gi
  let match = pattern.exec(text)
  while (match) {
    const word = match[0]
    if (Math.abs(word.length - term.length) <= maxDist) {
      const dist = levenshtein(termLower, word.toLowerCase())
      if (dist <= maxDist && dist < bestDist) {
        bestDist = dist
        bestIndex = match.index
      }
    }
    match = pattern.exec(text)
  }
  return bestIndex
}

function truncateText(text: string, maxChars: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= maxChars) return trimmed
  return `${trimmed.slice(0, maxChars)}\n...[truncated]`
}

function parseQueryGroupNumber(query: string): string | null {
  const match = query.match(/\b(?:group|level)\s*(\d+)\b/i)
  return match?.[1] ?? null
}

type PriceListSection = {
  text: string
  groupNum: string | null
  start: number
}

function splitPriceListSections(text: string): PriceListSection[] {
  const pattern = /\b(?:Group|Level|GROUP|LEVEL)\s+(\d+)\b/g
  const matches: { index: number; groupNum: string }[] = []
  let match = pattern.exec(text)
  while (match) {
    matches.push({ index: match.index, groupNum: match[1] })
    match = pattern.exec(text)
  }

  if (matches.length === 0) {
    return [{ text, groupNum: null, start: 0 }]
  }

  const sections: PriceListSection[] = []
  if (matches[0].index > 0) {
    sections.push({
      text: text.slice(0, matches[0].index),
      groupNum: null,
      start: 0,
    })
  }

  for (let i = 0; i < matches.length; i += 1) {
    const start = matches[i].index
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length
    sections.push({
      text: text.slice(start, end),
      groupNum: matches[i].groupNum,
      start,
    })
  }

  return sections
}

function countDollarPrices(text: string): number {
  const matches = text.match(/\$\s*[\d,]+(?:\.\d{2})?/g)
  return matches?.length ?? 0
}

function sectionMatchesProduct(section: PriceListSection, terms: string[]): boolean {
  const prominent = terms.filter(term => term.length >= 5)
  const checkTerms = prominent.length > 0 ? prominent : terms
  const matched = checkTerms.filter(term =>
    termMatchesInText(term, section.text),
  ).length
  const required = Math.max(1, Math.ceil(checkTerms.length * 0.5))
  return matched >= required
}

function scoreDistinctiveTermMatch(section: PriceListSection, terms: string[]): number {
  const sorted = [...terms]
    .filter(term => term.length >= 5)
    .sort((a, b) => b.length - a.length)
  for (const term of sorted) {
    if (termMatchesInText(term, section.text)) {
      return term.length * 6
    }
  }
  return 0
}

function extractGroupBlockPrice(sectionText: string): string | null {
  const matches = [...sectionText.matchAll(/\$\s*([\d,]+(?:\.\d{2})?)/g)]
  if (matches.length === 0) return null
  return matches[matches.length - 1][0].replace(/\s+/g, '')
}

function annotateGroupSectionText(section: PriceListSection, text: string): string {
  const price = extractGroupBlockPrice(text)
  if (!price || !section.groupNum) return text
  const header = `GROUP ${section.groupNum} SLAB PRICE: ${price} (listed at the bottom of this group block and applies to every product listed in Group ${section.groupNum} above unless a product row shows its own price)`
  return `${header}\n${text}`
}

function trimSectionWithPriceTail(section: string, maxChars: number): string {
  const trimmed = section.trim()
  if (trimmed.length <= maxChars) return trimmed

  const separator = '\n...[truncated]...\n'
  const tailSize = Math.min(2800, Math.floor(maxChars * 0.45))
  const headSize = maxChars - tailSize - separator.length
  if (headSize < 500) {
    return truncateText(trimmed, maxChars)
  }

  return `${trimmed.slice(0, headSize).trim()}${separator}${trimmed.slice(-tailSize).trim()}`
}

function scoreSectionForQuery(
  section: PriceListSection,
  terms: string[],
  queryGroupNum: string | null,
): number {
  let score = countMatchingTerms(terms, section.text) * 2
  score += scoreDistinctiveTermMatch(section, terms)
  if (queryGroupNum && section.groupNum === queryGroupNum) {
    score += 25
  }
  if (sectionMatchesProduct(section, terms)) {
    score += 12
    score += countDollarPrices(section.text) * 4
  }
  return score
}

function appendSiblingGroupPrice(
  section: PriceListSection,
  sections: PriceListSection[],
): string {
  if (contentHasDollarPrice(section.text) || !section.groupNum) {
    return section.text
  }

  const priced = sections
    .filter(
      item =>
        item.groupNum === section.groupNum &&
        item.start !== section.start &&
        contentHasDollarPrice(item.text),
    )
    .sort((a, b) => a.start - b.start)[0]

  if (!priced) return section.text

  const tailStart = Math.max(0, priced.text.length - 1500)
  return `${section.text.trim()}\n\n${priced.text.slice(tailStart).trim()}`
}

function excerptAroundTerms(text: string, terms: string[], maxChars: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= maxChars) return trimmed
  if (terms.length === 0) return truncateText(trimmed, maxChars)

  let bestIndex = 0
  let bestScore = -1
  for (const term of terms) {
    const found = findTermMatchIndex(trimmed, term)
    if (found === -1) continue
    const score = term.length
    if (score > bestScore) {
      bestScore = score
      bestIndex = found
    }
  }

  if (bestScore <= 0) return truncateText(trimmed, maxChars)

  let start = Math.max(0, bestIndex - Math.floor(maxChars * 0.4))
  const end = Math.min(trimmed.length, start + maxChars)
  if (end - start < maxChars) {
    start = Math.max(0, end - maxChars)
  }

  let slice = trimmed.slice(start, end)
  if (!contentHasDollarPrice(slice) && end < trimmed.length) {
    const extra = trimmed.slice(end, Math.min(trimmed.length, end + 2500))
    if (contentHasDollarPrice(extra)) {
      slice = `${slice}\n${extra}`
    }
  }

  if (slice.length <= maxChars) {
    const prefix = start > 0 ? '...[truncated]...\n' : ''
    const suffix = start + slice.length < trimmed.length ? '\n...[truncated]' : ''
    return `${prefix}${slice.trim()}${suffix}`
  }

  return trimSectionWithPriceTail(slice, maxChars)
}

export function extractPriceListExcerpt(
  text: string,
  query: string,
  maxChars: number,
): string {
  const trimmed = text.trim()
  if (!trimmed) return ''

  const terms = queryTerms(query)
  const queryGroupNum = parseQueryGroupNumber(query)
  const sections = splitPriceListSections(trimmed)

  if (sections.length === 1 && sections[0].groupNum === null) {
    return excerptAroundTerms(trimmed, terms, maxChars)
  }

  const ranked = sections
    .map(section => ({
      section,
      score: scoreSectionForQuery(section, terms, queryGroupNum),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      const priceDiff =
        countDollarPrices(b.section.text) - countDollarPrices(a.section.text)
      if (priceDiff !== 0) return priceDiff
      return a.section.start - b.section.start
    })

  const productMatches = ranked.filter(item =>
    sectionMatchesProduct(item.section, terms),
  )
  const candidates = productMatches.length > 0 ? productMatches : ranked

  const bestScore = candidates[0]?.score ?? 0
  if (bestScore === 0 && queryGroupNum) {
    const sameGroup = sections.filter(section => section.groupNum === queryGroupNum)
    const priced =
      sameGroup.find(section => contentHasDollarPrice(section.text)) ??
      sameGroup.sort((a, b) => a.start - b.start)[0]
    if (priced) {
      return trimSectionWithPriceTail(priced.text, maxChars)
    }
  }

  if (bestScore === 0) {
    return excerptAroundTerms(trimmed, terms, maxChars)
  }

  const chosenSection = candidates[0].section
  const mergedText = appendSiblingGroupPrice(chosenSection, sections)
  const sectionText = annotateGroupSectionText(chosenSection, mergedText)
  if (sectionText.length <= maxChars) {
    return sectionText.trim()
  }

  return trimSectionWithPriceTail(sectionText, maxChars)
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
      score: countMatchingTerms(
        terms,
        `${file.name} ${file.url} ${(file.file_text ?? '').slice(0, 8000)}`,
      ),
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

const FULL_FILE_EXTRACT_PROMPT =
  'Transcribe all text from this supplier price list document exactly as it appears. Include every product name, color group or level number, slab size, and dollar price. Preserve the document structure and list all entries completely. Do not summarize or omit anything.'

const INLINE_PDF_LIMIT = 4 * 1024 * 1024
const MAX_PDF_UPLOAD = 32 * 1024 * 1024
const FULL_FILE_EXTRACT_MAX_TOKENS = 16000

async function extractPdfInline(
  buffer: Buffer,
  filename: string,
): Promise<string | null> {
  const response = await openai.chat.completions.create({
    model: GPT_MINI_MODEL,
    temperature: 0,
    max_completion_tokens: FULL_FILE_EXTRACT_MAX_TOKENS,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: FULL_FILE_EXTRACT_PROMPT },
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
): Promise<string | null> {
  const uploaded = await openai.files.create({
    file: await toFile(buffer, pdfFileName(filename), {
      type: 'application/pdf',
    }),
    purpose: 'user_data',
  })

  try {
    const response = await openai.chat.completions.create({
      model: GPT_MINI_MODEL,
      temperature: 0,
      max_completion_tokens: FULL_FILE_EXTRACT_MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: FULL_FILE_EXTRACT_PROMPT },
            { type: 'file', file: { file_id: uploaded.id } },
          ],
        },
      ],
    })
    return response.choices[0]?.message?.content?.trim() ?? null
  } finally {
    await openai.files.delete(uploaded.id).catch(() => undefined)
  }
}

async function extractPdfWithOpenAI(
  buffer: Buffer,
  filename: string,
): Promise<string | null> {
  if (buffer.length > MAX_PDF_UPLOAD) return null

  try {
    if (buffer.length <= INLINE_PDF_LIMIT) {
      return await extractPdfInline(buffer, filename)
    }
    return await extractPdfViaUpload(buffer, filename)
  } catch {
    return null
  }
}

async function extractFullImageText(url: string): Promise<string | null> {
  try {
    const response = await openai.chat.completions.create({
      model: GPT_MINI_MODEL,
      temperature: 0,
      max_completion_tokens: FULL_FILE_EXTRACT_MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: FULL_FILE_EXTRACT_PROMPT,
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

async function saveSupplierFileText(fileId: number, text: string): Promise<void> {
  await db
    .execute('UPDATE supplier_files SET file_text = ? WHERE id = ?', [text, fileId])
    .catch(() => undefined)
}

async function extractFullTextFromFile(
  file: SupplierFileRow,
  onPhase?: (phase: 'downloading' | 'extracting') => void,
): Promise<string | null> {
  onPhase?.('downloading')
  const downloaded = await downloadAnyFile(file.url)
  if (!downloaded) return null

  onPhase?.('extracting')
  const ext = fileExtension(downloaded.filename, file.url)
  const { buffer, contentType } = downloaded
  let fullText: string | null = null

  if (isTextExtension(ext) || contentType.startsWith('text/')) {
    fullText = buffer.toString('utf8').trim() || null
  } else if (isPdfFile(ext, contentType, buffer)) {
    const pdfText = await withTimeout(
      extractPdfText(buffer),
      PDF_TEXT_EXTRACT_TIMEOUT_MS,
    )
    fullText = pdfText?.trim() || null

    if (!fullText) {
      const openAiText = await withTimeout(
        extractPdfWithOpenAI(buffer, downloaded.filename),
        OPENAI_EXTRACT_TIMEOUT_MS,
      )
      fullText = openAiText?.trim() || null
    }
  } else if (isImageExtension(ext) || contentType.startsWith('image/')) {
    const imageText = await withTimeout(
      extractFullImageText(file.url),
      OPENAI_EXTRACT_TIMEOUT_MS,
    )
    fullText = imageText?.trim() || null
  }

  return fullText?.trim() || null
}

async function extractSupplierFileText(
  file: SupplierFileRow,
  query: string,
  onPhase?: (phase: 'downloading' | 'extracting') => void,
): Promise<string | null> {
  const cached = file.file_text?.trim()
  if (cached) {
    return extractPriceListExcerpt(cached, query, MAX_FILE_CHARS)
  }

  const fullText = await extractFullTextFromFile(file, onPhase)
  if (!fullText) return null

  return extractPriceListExcerpt(fullText, query, MAX_FILE_CHARS)
}

export async function listSupplierFilesNeedingText(): Promise<SupplierFileIndexRow[]> {
  return selectMany<SupplierFileIndexRow>(
    db,
    `SELECT sf.id, sf.supplier_id, sf.name, sf.url, sf.file_text, s.supplier_name
       FROM supplier_files sf
       JOIN suppliers s ON s.id = sf.supplier_id
      WHERE sf.file_text IS NULL OR TRIM(sf.file_text) = ''
      ORDER BY sf.id`,
  )
}

export async function indexSupplierFileText(
  file: SupplierFileRow,
  onPhase?: (phase: 'downloading' | 'extracting') => void,
): Promise<boolean> {
  if (file.file_text?.trim()) return true
  const fullText = await extractFullTextFromFile(file, onPhase)
  if (!fullText) return false
  await saveSupplierFileText(file.id, fullText)
  return true
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
    'SELECT id, supplier_id, name, url, file_text FROM supplier_files WHERE supplier_id IN (?)',
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
    'When a Group N block lists products without individual prices and one price at the bottom of that block, that bottom price applies to every product in Group N above it. A GROUP N SLAB PRICE line in the excerpt states that group price explicitly.',
    'When one document from a supplier shows a product with a color group or level and size but no dollar price on its row, check the GROUP price line and every other SOURCE from that same supplier before saying the price is not specified.',
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

    const hasCachedText = Boolean(file.file_text?.trim())

    if (isImage && !hasCachedText && visionCalls >= MAX_VISION_FILES) {
      sections.push(`\nFILE: ${file.name} (${supplierName})`)
      sections.push('CONTENT: Skipped additional image files to limit processing.')
      continue
    }
    if (isImage && !hasCachedText) {
      visionCalls += 1
    }

    const emitFilePhase = (phase: 'downloading' | 'extracting') => {
      onProgress?.({
        state: 'reading',
        phase,
        fileType,
        name: file.name,
      })
    }

    emitFilePhase('downloading')

    const extracted = await extractSupplierFileText(file, query, emitFilePhase)
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
