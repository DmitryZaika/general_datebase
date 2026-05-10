import type { SSEEvent } from './types'

const encoder = new TextEncoder()

export function encodeSSEFrame(event: SSEEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
}

export function sseResponse(
  handler: (send: (event: SSEEvent) => void) => Promise<void>,
): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: SSEEvent) => controller.enqueue(encodeSSEFrame(event))
      try {
        await handler(send)
        send({ type: 'done' })
      } catch (err) {
        send({
          type: 'error',
          message: err instanceof Error ? err.message : 'Unknown error',
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
