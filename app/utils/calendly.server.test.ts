import { afterEach, describe, expect, it } from 'vitest'
import {
  getConfiguredCalendlyDemoUrl,
  resolveCalendlyDemoSchedulingUrl,
} from '~/utils/calendly.server'

describe('getConfiguredCalendlyDemoUrl', () => {
  afterEach(() => {
    delete process.env.CALENDLY_DEMO_URL
    delete process.env.VITE_CALENDLY_DEMO_URL
  })

  it('prefers CALENDLY_DEMO_URL at runtime', () => {
    process.env.CALENDLY_DEMO_URL = 'https://calendly.com/granite-manager/demo'
    expect(getConfiguredCalendlyDemoUrl()).toBe(
      'https://calendly.com/granite-manager/demo',
    )
  })

  it('falls back to VITE_CALENDLY_DEMO_URL', () => {
    process.env.VITE_CALENDLY_DEMO_URL = 'https://calendly.com/granite-manager/demo'
    expect(getConfiguredCalendlyDemoUrl()).toBe(
      'https://calendly.com/granite-manager/demo',
    )
  })
})

describe('resolveCalendlyDemoSchedulingUrl', () => {
  afterEach(() => {
    delete process.env.CALENDLY_DEMO_URL
    delete process.env.VITE_CALENDLY_DEMO_URL
    delete process.env.CALENDLY_API_TOKEN
  })

  it('returns configured url without calling the api', async () => {
    process.env.CALENDLY_DEMO_URL = 'https://calendly.com/granite-manager/demo'
    await expect(resolveCalendlyDemoSchedulingUrl()).resolves.toBe(
      'https://calendly.com/granite-manager/demo',
    )
  })
})
