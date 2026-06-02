import OpenAI from 'openai'
import { toFile } from 'openai/uploads'
import type { ActionFunctionArgs } from 'react-router'
import { z } from 'zod'
import { fetchValueRaw, getAuthString } from '~/utils/cloudtalk.server'
import { posthogClient } from '~/utils/posthog.server'
import { getEmployeeUser } from '~/utils/session.server'

const client = new OpenAI({
  apiKey: process.env.OPEN_AI_SECRET_KEY,
})

const callIdSchema = z.coerce.number().int().positive()

const bodySchema = z.object({
  recordingLink: z.string().optional(),
})

function createErrorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function isAudioContentType(contentType: string): boolean {
  const normalized = contentType.toLowerCase()
  return (
    normalized.includes('audio/') ||
    normalized.includes('octet-stream') ||
    normalized.includes('video/mp4')
  )
}

async function fetchRecordingBuffer(
  companyId: number,
  callId: number,
  recordingLink?: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const recordingResponse = await fetchValueRaw(
    `calls/recording/${callId}.json`,
    companyId,
    {},
  )
  const contentType = recordingResponse.headers.get('content-type') ?? ''

  if (isAudioContentType(contentType)) {
    return {
      buffer: Buffer.from(await recordingResponse.arrayBuffer()),
      mimeType: contentType || 'audio/wav',
    }
  }

  const link = recordingLink?.trim()
  if (!link) {
    throw new Error('Recording not available')
  }

  const auth = await getAuthString(companyId)
  const linkedResponse = await fetch(link, {
    headers: { Authorization: `Basic ${auth}` },
  })

  if (!linkedResponse.ok) {
    throw new Error('Failed to fetch recording')
  }

  return {
    buffer: Buffer.from(await linkedResponse.arrayBuffer()),
    mimeType: linkedResponse.headers.get('content-type') ?? 'audio/wav',
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  let companyId: number
  try {
    const user = await getEmployeeUser(request)
    companyId = user.company_id
  } catch (error) {
    posthogClient.captureException(error)
    return createErrorResponse('Failed to authorize', 401)
  }

  const callId = callIdSchema.parse(params.callId)

  let recordingLink: string | undefined
  try {
    const parsed = bodySchema.parse(await request.json())
    recordingLink = parsed.recordingLink
  } catch (error) {
    posthogClient.captureException(error)
    return createErrorResponse('Invalid request data', 400)
  }

  try {
    const { buffer, mimeType } = await fetchRecordingBuffer(
      companyId,
      callId,
      recordingLink,
    )

    if (buffer.length === 0) {
      return createErrorResponse('Recording is empty', 404)
    }

    const extension =
      mimeType.includes('mpeg') || mimeType.includes('mp3') ? 'mp3' : 'wav'
    const file = await toFile(buffer, `call-${callId}.${extension}`, { type: mimeType })

    const transcription = await client.audio.transcriptions.create({
      file,
      model: 'gpt-4o-mini-transcribe',
      language: 'en',
    })

    const text = transcription.text.trim()
    if (!text) {
      return createErrorResponse('No speech detected in recording', 422)
    }

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    posthogClient.captureException(error)
    return createErrorResponse('Failed to transcribe call', 500)
  }
}
