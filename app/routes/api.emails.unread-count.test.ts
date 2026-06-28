import type { LoaderFunctionArgs } from 'react-router'
import { describe, expect, test } from 'vitest'
import { loader } from './api.emails.unread-count'

describe('GET /api/emails/unread-count — auth wiring', () => {
  test('redirects to /login when no session cookie is present', async () => {
    const args = {
      request: new Request('http://localhost/api/emails/unread-count'),
      params: {},
    } as unknown as LoaderFunctionArgs
    const response = (await loader(args)) as Response

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('/login')
  })
})
