import { describe, expect, it } from 'vitest'
import { improveEmailTask } from '../tasks/improveEmail.task'

describe('improveEmailTask.buildMessages', () => {
  it('puts system prompt first, user body second', () => {
    const messages = improveEmailTask.buildMessages({ body: 'helo wrld' })
    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe('system')
    expect(messages[1]).toEqual({ role: 'user', content: 'helo wrld' })
  })

  it('passes the body verbatim, no transformation', () => {
    const body = '  multi\nline\n\nbody  '
    const messages = improveEmailTask.buildMessages({ body })
    expect(messages[1].content).toBe(body)
  })

  it('declares structured output schema', () => {
    expect(improveEmailTask.outputSchema).toBeDefined()
  })
})
