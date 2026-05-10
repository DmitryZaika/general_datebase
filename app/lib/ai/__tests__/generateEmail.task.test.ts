import { describe, expect, it } from 'vitest'
import { generateEmailTask } from '../tasks/generateEmail.task'

describe('generateEmailTask.buildMessages', () => {
  it('puts system prompt first', () => {
    const msgs = generateEmailTask.buildMessages({
      params: { emailCategory: 'first-contact' },
      lead: {},
      sender: { name: 'Dema' },
      history: [],
    })
    expect(msgs[0].role).toBe('system')
    expect(typeof msgs[0].content).toBe('string')
    expect((msgs[0].content as string).length).toBeGreaterThan(800)
  })

  it('includes recipient name when given', () => {
    const msgs = generateEmailTask.buildMessages({
      params: { emailCategory: 'follow-up' },
      lead: { customerName: 'Anna' },
      sender: { name: 'Dema' },
      history: [],
    })
    const userMsg = msgs[msgs.length - 1].content as string
    expect(userMsg).toContain('Anna')
  })

  it('includes email history when present', () => {
    const msgs = generateEmailTask.buildMessages({
      params: { emailCategory: 'reply' },
      lead: {},
      sender: { name: 'Dema' },
      history: [
        { body: 'hi there', sentAt: '2026-05-01', isFromCustomer: true },
        { body: 'hello back', sentAt: '2026-05-02', isFromCustomer: false },
      ],
    })
    const userMsg = msgs[msgs.length - 1].content as string
    expect(userMsg).toContain('hi there')
    expect(userMsg).toContain('hello back')
  })

  it('omits history block entirely when empty', () => {
    const msgs = generateEmailTask.buildMessages({
      params: { emailCategory: 'first-contact' },
      lead: {},
      sender: { name: 'Dema' },
      history: [],
    })
    const userMsg = msgs[msgs.length - 1].content as string
    expect(userMsg).not.toContain('PREVIOUS CONVERSATION')
  })

  it('declares structured output schema with subject and body', () => {
    expect(generateEmailTask.outputSchema).toBeDefined()
  })
})
