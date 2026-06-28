import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getConfiguredCalendlyDemoUrl,
  resetCalendlyDemoUrlCache,
  resolveCalendlyDemoSchedulingUrl,
} from '~/utils/calendly.server'
import { DEFAULT_CALENDLY_DEMO_URL } from '~/utils/calendlyUrls'

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
    resetCalendlyDemoUrlCache()
    vi.unstubAllEnvs()
  })

  it('returns configured url without calling the api', async () => {
    process.env.CALENDLY_DEMO_URL = 'https://calendly.com/granite-manager/demo'
    await expect(resolveCalendlyDemoSchedulingUrl()).resolves.toBe(
      'https://calendly.com/granite-manager/demo',
    )
  })

  it('falls back to the default demo link in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    await expect(resolveCalendlyDemoSchedulingUrl()).resolves.toBe(
      DEFAULT_CALENDLY_DEMO_URL,
    )
  })
})
