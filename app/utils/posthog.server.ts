import { PostHog } from 'posthog-node'

export const posthogClient = new PostHog(process.env.VITE_POSTHOG_KEY || '', {
  host: 'https://us.i.posthog.com',
  enableExceptionAutocapture: true,
})
