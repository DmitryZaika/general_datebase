import OpenAI, { toFile } from 'openai'
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import sharp from 'sharp'
import { db } from '~/db.server'
import { getSession } from '~/sessions.server'
import { GPT_MINI_MODEL } from '~/utils/openaiModels'
import { selectMany } from '~/utils/queryHelpers'
import { downloadFileAsBuffer } from '~/utils/s3.server'
import { getUserBySessionId } from '~/utils/session.server'

function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPEN_AI_SECRET_KEY,
  })
}

interface DesignStoneRow {
  id: number
  name: string
  type: string | null
}

interface DesignStoneWithUrl extends DesignStoneRow {
  url: string | null
}

const MAX_KITCHEN_IMAGE_BYTES = 15 * 1024 * 1024
const MAX_STONES_PER_REQUEST = 3

type AiDesignSurface = 'countertops' | 'fireplace' | 'full_height_backsplash'

const AI_DESIGN_SURFACES: AiDesignSurface[] = [
  'countertops',
  'fireplace',
  'full_height_backsplash',
]

async function requireCompanyId(request: Request): Promise<number | null> {
  const session = await getSession(request.headers.get('Cookie'))
  const activeSession = session.data.sessionId || null
  if (!activeSession) return null
  const user = (await getUserBySessionId(activeSession)) || null
  if (!user?.company_id) return null
  return user.company_id
}

async function loadInStockStones(
  companyId: number,
  search: string,
  limit: number,
): Promise<DesignStoneRow[]> {
  const hasSearch = search.length > 0
  const query = `SELECT s.id, s.name, s.type
    FROM stones s
    LEFT JOIN slab_inventory AS si ON (
      si.stone_id = s.id
      OR si.stone_id IN (
        SELECT source_stone_id
        FROM stone_slab_links
        WHERE stone_id = s.id
      )
    )
    WHERE s.company_id = ?
    AND s.deleted_at IS NULL
    AND s.is_display = 1
    ${hasSearch ? 'AND UPPER(s.name) LIKE UPPER(?)' : ''}
    GROUP BY s.id, s.name, s.type, s.regular_stock
    HAVING (
      CAST(SUM(CASE WHEN si.id IS NOT NULL AND si.sale_id IS NULL AND si.cut_date IS NULL AND si.deleted_at IS NULL THEN 1 ELSE 0 END) AS UNSIGNED) > 0
      OR s.regular_stock = 1
    )
    ORDER BY s.name ASC
    LIMIT ?`

  const params = hasSearch ? [companyId, `%${search}%`, limit] : [companyId, limit]

  return selectMany<DesignStoneRow>(db, query, params)
}

export async function loader({ request }: LoaderFunctionArgs) {
  const companyId = await requireCompanyId(request)
  if (companyId === null) {
    return Response.json({ stones: [] }, { status: 401 })
  }

  const search = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  const stones = await loadInStockStones(companyId, search, search ? 40 : 1000)

  return Response.json({ stones })
}

function parseStoneIds(raw: string | null): number[] {
  if (!raw) return []
  const ids: number[] = []
  for (const part of raw.split(',')) {
    const id = Number.parseInt(part.trim(), 10)
    if (Number.isInteger(id) && id > 0 && !ids.includes(id)) {
      ids.push(id)
    }
  }
  return ids
}

function instructionsMentionBacksplash(instructions: string): boolean {
  return /\bbacksplash\b/i.test(instructions)
}

function isAiDesignSurface(value: string): value is AiDesignSurface {
  return AI_DESIGN_SURFACES.some(surface => surface === value)
}

function parseSurfaces(raw: string | null): AiDesignSurface[] {
  if (!raw) return ['countertops']
  const surfaces: AiDesignSurface[] = []
  for (const part of raw.split(',')) {
    const value = part.trim()
    if (isAiDesignSurface(value) && !surfaces.includes(value)) {
      surfaces.push(value)
    }
  }
  return surfaces.length > 0 ? surfaces : ['countertops']
}

function buildDesignPrompt(
  stoneName: string,
  stoneType: string | null,
  surfaces: AiDesignSurface[],
  extraInstructions?: string,
  options?: {
    hasSwatch?: boolean
    hasInstalledReference?: boolean
    stoneProfile?: string
  },
): string {
  const applyParts: string[] = []
  if (surfaces.includes('countertops')) {
    applyParts.push(
      'countertop horizontal surfaces (island top + perimeter counter tops)',
    )
  }
  if (surfaces.includes('fireplace')) {
    applyParts.push('fireplace surround and hearth')
  }
  if (surfaces.includes('full_height_backsplash')) {
    applyParts.push('full-height backsplash between counters and upper cabinets')
  }

  const trimmedInstructions = extraInstructions?.trim()
  const backsplashLocked =
    !surfaces.includes('full_height_backsplash') &&
    !instructionsMentionBacksplash(trimmedInstructions ?? '')
  const hasUserChanges = Boolean(trimmedInstructions)

  const hasSwatch = options?.hasSwatch ?? false
  const hasInstalledReference = options?.hasInstalledReference ?? false
  const stoneProfile = options?.stoneProfile?.trim() ?? ''
  const materialLabel = stoneType ? `${stoneName} (${stoneType})` : stoneName

  const referenceLines = [
    'Image 1 = the original kitchen photo. Preserve this room exactly unless the user explicitly asks to change something below.',
  ]
  if (hasSwatch) {
    referenceLines.push(
      'Image 2 = inventory slab photo. Exact material color, undertone, and veining reference.',
    )
  }
  if (hasInstalledReference) {
    referenceLines.push(
      `${hasSwatch ? 'Image 3' : 'Image 2'} = real installed project showing this stone on counters. Match how the stone looks in this install photo.`,
    )
  }

  const prompt = [
    'TASK: Real photograph with stone swapped on selected surfaces. Not a render, not stylized art.',
    '',
    'REFERENCE IMAGES:',
    ...referenceLines,
    hasSwatch || hasInstalledReference
      ? 'Reference images must NOT appear in the output.'
      : `Material: ${materialLabel}. Match this stone as closely as possible.`,
    '',
    'APPLY STONE TO THESE SURFACES ONLY:',
    ...applyParts.map(part => `- ${part}`),
  ]

  if (stoneProfile) {
    prompt.push(
      '',
      'EXACT STONE APPEARANCE (from inventory slab analysis):',
      stoneProfile,
      'Applied stone must match these colors and patterns exactly. Do not simplify, grey out, beige out, or shift the palette.',
    )
  }

  prompt.push(
    '',
    'STONE MATCHING (highest priority on allowed surfaces):',
    '- Copy exact base color, undertones, and secondary hues from the slab reference',
    '- Copy vein pattern, direction, density, scale, and contrast from the slab reference',
    '- If the slab has sage green fields, bright white patches, and charcoal black veins — reproduce those same colors on counters',
    '- Match polish level and natural stone texture from the reference',
    '- Result must look like real fabricated stone from this slab, as in a showroom or install photo',
    '',
    'SWATCH BACKGROUND — IGNORE COMPLETELY:',
    '- Reference photos may show the slab on a white, grey, or studio background — ignore that background entirely',
    '- Sample color, veining, and finish ONLY from stone slab pixels',
    '- Never copy the photo background onto countertops or anywhere in the output',
    '',
    'COLOR ACCURACY — NO FILTERS:',
    '- Output must look like an unedited photograph, not AI art',
    '- Do NOT apply cinematic grading, HDR, vignette, blur, glow, haze, or color filters',
    '- Do NOT lighten, darken, warm, cool, desaturate, or shift hues on the applied stone',
    '- Do NOT grey-out, beige-out, or mute the stone palette',
    '- Applied stone colors must match the slab reference exactly under the kitchen lighting',
    '- Keep Image 1 overall white balance, exposure, and color grading unchanged',
    '- Only selected surface material pixels change; every other color in the photo stays identical',
  )

  if (backsplashLocked) {
    prompt.push(
      '',
      'BACKSPLASH AND WALLS BEHIND COUNTERS — DO NOT CHANGE:',
      '- Keep the backsplash, wall tiles, and vertical surfaces behind counters exactly as Image 1',
      '- Do NOT apply stone to the backsplash or any wall area unless listed in APPLY STONE TO above',
      '- Countertop material stops at the counter edge; nothing above the counter may change',
    )
  }

  if (hasUserChanges) {
    prompt.push(
      '',
      'DEFAULT: Do not change cabinets, walls, floor, appliances, decor, or layout unless the user asks below.',
      ...(backsplashLocked
        ? [
            '- Backsplash stays unchanged unless the user explicitly asked to change it below',
          ]
        : []),
      '',
      'USER REQUESTED CHANGES — you MAY change other details ONLY as explicitly described here:',
      trimmedInstructions ?? '',
      '',
      'Apply only what the user wrote above. Do not add extra redesigns they did not ask for.',
    )
  } else {
    const lockedLines = [
      '',
      'DO NOT CHANGE unless listed in APPLY STONE TO above:',
      '- Cabinets: same style, color, finish, doors, hardware — no new hoods or cabinet redesign',
      !surfaces.includes('countertops') ? '- Countertops — keep original material' : '',
      !surfaces.includes('fireplace') ? '- Fireplace — keep original material' : '',
      '- Walls, ceiling, trim, flooring, rugs, appliances, fixtures, windows, decor, and objects',
      '- Camera angle, lighting, and composition',
      '',
      'Do not add or remove objects. Do not restyle the room.',
    ].filter(line => line.length > 0)
    prompt.push(...lockedLines)
  }

  prompt.push(
    '',
    hasUserChanges
      ? `FINAL CHECK: stone only on selected surfaces${backsplashLocked ? ', backsplash unchanged' : ''}, only user-requested extras applied.`
      : `FINAL CHECK: stone only on selected surfaces${backsplashLocked ? ', backsplash identical to Image 1' : ''}, everything else identical to Image 1.`,
  )

  return prompt.join('\n')
}

async function fetchRemoteImage(
  candidate: string,
): Promise<{ buffer: Buffer; contentType: string; filename: string } | null> {
  try {
    const response = await fetch(candidate)
    if (!response.ok) return null
    const buffer = Buffer.from(await response.arrayBuffer())
    const contentType = response.headers.get('content-type') || 'image/png'
    const filename = candidate.split('/').pop() || 'image.png'
    return { buffer, contentType, filename }
  } catch {
    return null
  }
}

async function loadRemoteImage(
  url: string,
): Promise<{ buffer: Buffer; contentType: string; filename: string } | null> {
  const trimmed = url.trim()
  if (!trimmed) return null

  const candidates = [trimmed]
  if (trimmed.includes('-icon.')) {
    candidates.unshift(trimmed.replace('-icon.', '.'))
  }

  for (const candidate of candidates) {
    if (candidate.includes('amazonaws.com')) {
      const s3File = await downloadFileAsBuffer(candidate)
      if (s3File) {
        return {
          buffer: s3File.buffer,
          contentType: s3File.contentType,
          filename: s3File.filename,
        }
      }
    }

    const fetched = await fetchRemoteImage(candidate)
    if (fetched) {
      return fetched
    }
  }

  return null
}

function extensionForMime(mime: string): string {
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg'
  if (mime.includes('webp')) return 'webp'
  return 'png'
}

function isOpenAiSupportedMime(mime: string): boolean {
  const normalized = mime.toLowerCase().split(';')[0].trim()
  return (
    normalized === 'image/jpeg' ||
    normalized === 'image/png' ||
    normalized === 'image/webp'
  )
}

async function normalizeImageForOpenAI(
  buffer: Buffer,
  contentType: string,
): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
  const mime = (contentType || 'image/png').toLowerCase().split(';')[0].trim()
  if (isOpenAiSupportedMime(mime)) {
    const ext = extensionForMime(mime)
    return { buffer, contentType: mime, filename: `image.${ext}` }
  }

  const converted = await sharp(buffer).rotate().png({ compressionLevel: 6 }).toBuffer()
  return {
    buffer: converted,
    contentType: 'image/png',
    filename: 'image.png',
  }
}

async function prepareKitchenForOpenAI(
  buffer: Buffer,
  contentType: string,
): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
  const normalized = await normalizeImageForOpenAI(buffer, contentType)
  const prepared = await sharp(normalized.buffer)
    .rotate()
    .resize(2048, 2048, {
      fit: 'inside',
      withoutEnlargement: true,
      kernel: sharp.kernel.lanczos3,
    })
    .png({ compressionLevel: 6 })
    .toBuffer()
  return {
    buffer: prepared,
    contentType: 'image/png',
    filename: 'kitchen.png',
  }
}

async function prepareSwatchForOpenAI(
  buffer: Buffer,
  contentType: string,
): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
  const normalized = await normalizeImageForOpenAI(buffer, contentType)
  let pipeline = sharp(normalized.buffer).rotate()

  const trimmed = await pipeline
    .clone()
    .trim({ threshold: 12 })
    .toBuffer()
    .catch(() => null)
  if (trimmed) {
    pipeline = sharp(trimmed)
  }

  const meta = await pipeline.metadata()
  const minSide = Math.min(meta.width ?? 0, meta.height ?? 0)
  if (minSide > 0 && minSide < 1024) {
    pipeline = pipeline.resize(1024, 1024, {
      fit: 'inside',
      withoutEnlargement: false,
      kernel: sharp.kernel.lanczos3,
    })
  } else if (minSide > 1536) {
    pipeline = pipeline.resize(1536, 1536, {
      fit: 'inside',
      withoutEnlargement: true,
      kernel: sharp.kernel.lanczos3,
    })
  }

  const prepared = await pipeline.png({ compressionLevel: 6 }).toBuffer()
  return {
    buffer: prepared,
    contentType: 'image/png',
    filename: 'stone-swatch.png',
  }
}

function bufferToDataUrl(buffer: Buffer, contentType: string): string {
  const mime = (contentType || 'image/png').split(';')[0].trim()
  return `data:${mime};base64,${buffer.toString('base64')}`
}

async function loadInstalledStoneImage(
  stoneId: number,
): Promise<{ buffer: Buffer; contentType: string; filename: string } | null> {
  const direct = await selectMany<{ url: string }>(
    db,
    'SELECT url FROM installed_stones WHERE stone_id = ? LIMIT 1',
    [stoneId],
  )
  if (direct.length > 0 && direct[0].url) {
    return loadRemoteImage(direct[0].url)
  }

  const linked = await selectMany<{ url: string }>(
    db,
    `SELECT is2.url
     FROM stone_image_links sil
     JOIN installed_stones is2 ON is2.stone_id = sil.source_stone_id
     WHERE sil.stone_id = ?
     LIMIT 1`,
    [stoneId],
  )
  if (linked.length > 0 && linked[0].url) {
    return loadRemoteImage(linked[0].url)
  }

  return null
}

async function analyzeStoneAppearance(
  openai: OpenAI,
  swatchBuffer: Buffer,
  swatchContentType: string,
  stoneName: string,
  stoneType: string | null,
): Promise<string> {
  try {
    const dataUrl = bufferToDataUrl(swatchBuffer, swatchContentType)
    const materialLabel = stoneType ? `${stoneName} (${stoneType})` : stoneName
    const response = await openai.chat.completions.create({
      model: GPT_MINI_MODEL,
      temperature: 0,
      max_completion_tokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this ${materialLabel} slab photograph. Describe ONLY the stone material for matching on kitchen countertops. Be very specific about colors (for example sage green, olive grey, charcoal black, bright white). Cover base colors, undertones, primary veins, fine secondary veins, contrast, polish level, and overall pattern. Ignore any photo background or text overlay. Plain bullet points only, no markdown.`,
            },
            {
              type: 'image_url',
              image_url: { url: dataUrl, detail: 'high' },
            },
          ],
        },
      ],
    })
    return response.choices[0]?.message?.content?.trim() ?? ''
  } catch {
    return ''
  }
}

async function getOutputSize(
  buffer: Buffer,
): Promise<'1536x1024' | '1024x1536' | '1024x1024'> {
  const meta = await sharp(buffer).metadata()
  if (!meta.width || !meta.height) return '1536x1024'
  const ratio = meta.width / meta.height
  if (ratio > 1.15) return '1536x1024'
  if (ratio < 0.87) return '1024x1536'
  return '1024x1024'
}

function extractGeneratedImage(generated: OpenAI.Images.ImagesResponse): string | null {
  const item = generated.data?.[0]
  if (!item) return null
  if (item.b64_json) {
    return `data:image/png;base64,${item.b64_json}`
  }
  if (item.url) {
    return item.url
  }
  return null
}

interface PreparedKitchenImage {
  buffer: Buffer
  contentType: string
  filename: string
}

async function generateDesignImage(
  kitchen: PreparedKitchenImage,
  outputSize: '1536x1024' | '1024x1536' | '1024x1024',
  stone: DesignStoneWithUrl,
  surfaces: AiDesignSurface[],
  extraInstructions: string,
): Promise<{ image: string | null; error: string | null }> {
  const openai = getOpenAIClient()
  const kitchenFile = await toFile(kitchen.buffer, kitchen.filename, {
    type: kitchen.contentType,
  })

  const swatchRaw = stone.url ? await loadRemoteImage(stone.url) : null
  const swatchPrepared = swatchRaw
    ? await prepareSwatchForOpenAI(swatchRaw.buffer, swatchRaw.contentType)
    : null

  const installedRaw = await loadInstalledStoneImage(stone.id)
  const installedPrepared = installedRaw
    ? await prepareKitchenForOpenAI(installedRaw.buffer, installedRaw.contentType)
    : null

  const stoneProfile =
    swatchPrepared !== null
      ? await analyzeStoneAppearance(
          openai,
          swatchPrepared.buffer,
          swatchPrepared.contentType,
          stone.name,
          stone.type,
        )
      : ''

  const images: Awaited<ReturnType<typeof toFile>>[] = [kitchenFile]
  if (swatchPrepared) {
    images.push(
      await toFile(swatchPrepared.buffer, swatchPrepared.filename, {
        type: swatchPrepared.contentType,
      }),
    )
  }
  if (installedPrepared) {
    images.push(
      await toFile(installedPrepared.buffer, installedPrepared.filename, {
        type: installedPrepared.contentType,
      }),
    )
  }

  const prompt = buildDesignPrompt(
    stone.name,
    stone.type,
    surfaces,
    extraInstructions,
    {
      hasSwatch: swatchPrepared !== null,
      hasInstalledReference: installedPrepared !== null,
      stoneProfile,
    },
  )

  const models = ['gpt-image-1.5', 'gpt-image-1'] as const

  for (const model of models) {
    try {
      const generated = await openai.images.edit({
        model,
        image: images,
        prompt,
        size: outputSize,
        quality: 'high',
        input_fidelity: 'high',
        output_format: 'png',
        background: 'opaque',
      })

      const image = extractGeneratedImage(generated)
      if (image) {
        if (image.startsWith('http')) {
          const response = await fetch(image)
          if (!response.ok) {
            continue
          }
          const buffer = Buffer.from(await response.arrayBuffer())
          return {
            image: `data:image/png;base64,${buffer.toString('base64')}`,
            error: null,
          }
        }
        return { image, error: null }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Image generation failed'
      if (model === models[models.length - 1]) {
        return { image: null, error: message }
      }
    }
  }

  return { image: null, error: 'Image generation returned no result' }
}

export async function action({ request }: ActionFunctionArgs) {
  const companyId = await requireCompanyId(request)
  if (companyId === null) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const kitchen = formData.get('kitchen')
  if (!(kitchen instanceof File)) {
    return Response.json({ error: 'No kitchen image provided.' }, { status: 400 })
  }
  if (!kitchen.type.startsWith('image/')) {
    return Response.json({ error: 'Only image files are allowed.' }, { status: 400 })
  }
  if (kitchen.size > MAX_KITCHEN_IMAGE_BYTES) {
    return Response.json({ error: 'Image is too large (max 15MB).' }, { status: 400 })
  }

  const stoneIds = parseStoneIds(
    typeof formData.get('stoneIds') === 'string'
      ? String(formData.get('stoneIds'))
      : null,
  )
  if (stoneIds.length === 0) {
    return Response.json({ error: 'Select at least one stone.' }, { status: 400 })
  }
  if (stoneIds.length > MAX_STONES_PER_REQUEST) {
    return Response.json(
      { error: `Maximum ${MAX_STONES_PER_REQUEST} stones per request.` },
      { status: 400 },
    )
  }

  const surfaces = parseSurfaces(
    typeof formData.get('surfaces') === 'string'
      ? String(formData.get('surfaces'))
      : null,
  )
  const extraInstructions =
    typeof formData.get('instructions') === 'string'
      ? String(formData.get('instructions')).trim()
      : ''

  const placeholders = stoneIds.map(() => '?').join(',')
  const stones = await selectMany<DesignStoneWithUrl>(
    db,
    `SELECT id, name, url, type FROM stones
     WHERE company_id = ? AND deleted_at IS NULL AND id IN (${placeholders})`,
    [companyId, ...stoneIds],
  )
  const usableStones = stones.filter(stone => Boolean(stone.url))
  if (usableStones.length === 0) {
    return Response.json(
      { error: 'The selected stones do not have a reference image.' },
      { status: 400 },
    )
  }

  const kitchenBuffer = Buffer.from(await kitchen.arrayBuffer())
  const kitchenMime = kitchen.type || 'image/png'
  const kitchenPrepared = await prepareKitchenForOpenAI(kitchenBuffer, kitchenMime)
  const outputSize = await getOutputSize(kitchenPrepared.buffer)

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      const send = (payload: Record<string, string | number>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`))
      }

      let successCount = 0
      let firstError: string | null = null

      await Promise.all(
        usableStones.map(stone =>
          generateDesignImage(
            kitchenPrepared,
            outputSize,
            stone,
            surfaces,
            extraInstructions,
          )
            .then(({ image, error }) => {
              if (image) {
                successCount += 1
                send({
                  type: 'design',
                  stoneId: stone.id,
                  stoneName: stone.name,
                  image,
                })
                return
              }
              const message = error ?? `Could not generate design for ${stone.name}.`
              if (!firstError) {
                firstError = message
              }
              send({
                type: 'stoneError',
                stoneName: stone.name,
                error: message,
              })
            })
            .catch(error => {
              const message =
                error instanceof Error
                  ? error.message
                  : `Could not generate design for ${stone.name}.`
              if (!firstError) {
                firstError = message
              }
              send({
                type: 'stoneError',
                stoneName: stone.name,
                error: message,
              })
            }),
        ),
      )

      if (successCount === 0) {
        send({
          type: 'error',
          error: firstError ?? 'Could not generate a design. Please try again.',
        })
      } else {
        send({ type: 'done', count: successCount })
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
    },
  })
}
