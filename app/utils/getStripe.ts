import Stripe from 'stripe'

// We can safely assert the type here because we've checked it exists

export const getStripe = () => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY as string
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set in environment variables')
  }
  return new Stripe(stripeSecretKey, {
    apiVersion: '2025-05-28.basil',
  })
}
