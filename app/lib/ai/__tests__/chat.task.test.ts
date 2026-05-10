import { describe, expect, it } from 'vitest'
import { chatTask } from '../tasks/chat.task'

describe('chatTask.buildMessages', () => {
  it('starts new conversation with system + user messages', () => {
    const msgs = chatTask.buildMessages({
      mode: 'new',
      query: 'How long does a granite installation take?',
      instructions: [
        { id: 1, title: 'Lead times', rich_text: 'Standard install is 2-3 weeks.' },
      ],
    })
    expect(msgs[0].role).toBe('system')
    expect(msgs[0].content as string).toContain('Lead times')
    expect(msgs[0].content as string).toContain('Standard install is 2-3 weeks.')
    expect(msgs[msgs.length - 1]).toEqual({
      role: 'user',
      content: 'How long does a granite installation take?',
    })
  })

  it('continues conversation by appending user query to history', () => {
    const msgs = chatTask.buildMessages({
      mode: 'continue',
      query: 'Got it, thanks',
      history: [
        { role: 'system', content: 'old system' },
        { role: 'user', content: 'first question' },
        { role: 'assistant', content: 'first answer' },
      ],
    })
    expect(msgs).toHaveLength(4)
    expect(msgs[3]).toEqual({ role: 'user', content: 'Got it, thanks' })
  })

  it('formats instructions as readable markdown, not JSON', () => {
    const msgs = chatTask.buildMessages({
      mode: 'new',
      query: 'q',
      instructions: [
        { id: 1, title: 'Pricing', rich_text: '$80/sqft baseline' },
        { id: 2, title: 'Hours', rich_text: '8am-5pm Mon-Fri' },
      ],
    })
    const sys = msgs[0].content as string
    expect(sys).toContain('## Pricing')
    expect(sys).toContain('## Hours')
    expect(sys).not.toContain('rich_text')
    expect(sys).not.toContain('"id":')
  })

  it('handles empty instructions gracefully', () => {
    const msgs = chatTask.buildMessages({
      mode: 'new',
      query: 'q',
      instructions: [],
    })
    expect(msgs[0].content as string).toContain('no instructions configured')
  })
})
