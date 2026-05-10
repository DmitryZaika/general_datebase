import { describe, expect, it } from 'vitest'
import { encodeSSEFrame } from '../streaming.server'

describe('encodeSSEFrame', () => {
  it('encodes a delta event', () => {
    const frame = encodeSSEFrame({ type: 'delta', content: 'hello' })
    expect(new TextDecoder().decode(frame)).toBe(
      'data: {"type":"delta","content":"hello"}\n\n',
    )
  })

  it('encodes a done event', () => {
    const frame = encodeSSEFrame({ type: 'done' })
    expect(new TextDecoder().decode(frame)).toBe('data: {"type":"done"}\n\n')
  })

  it('encodes an error event', () => {
    const frame = encodeSSEFrame({ type: 'error', message: 'boom' })
    expect(new TextDecoder().decode(frame)).toBe(
      'data: {"type":"error","message":"boom"}\n\n',
    )
  })

  it('encodes a final event with arbitrary data', () => {
    const frame = encodeSSEFrame({
      type: 'final',
      data: { subject: 'Hi', body: 'Hello there' },
    })
    expect(new TextDecoder().decode(frame)).toBe(
      'data: {"type":"final","data":{"subject":"Hi","body":"Hello there"}}\n\n',
    )
  })
})
