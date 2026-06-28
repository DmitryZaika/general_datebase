export function calculateMonthlyPrice(userCount: number): number {
  const users = Math.max(1, Math.min(500, Math.floor(userCount)))
  if (users <= 10) return 300
  return 300 + (users - 10) * 30
}

export function pricingSummary(userCount: number): string {
  const users = Math.max(1, Math.floor(userCount))
  if (users <= 10) {
    return 'Flat rate for up to 10 users'
  }
  return '$300 for first 10 users + $30 for each additional user'
}
