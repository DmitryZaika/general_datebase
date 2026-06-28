export type SalesRepRankTier = 'green' | 'yellow' | 'orange' | 'red'

export type SalesRepMonthCount = {
  salesRepId: number
  salesRepName: string
  count: number
  rankTier: SalesRepRankTier | null
}

const RANK_TIER_TEXT_CLASS: Record<SalesRepRankTier, string> = {
  green: 'text-green-600',
  yellow: 'text-yellow-600',
  orange: 'text-orange-600',
  red: 'text-red-600',
}

export function getSalesRepRankTierColorClass(tier: SalesRepRankTier | null): string {
  if (!tier) return ''
  return RANK_TIER_TEXT_CLASS[tier]
}

function getSalesRepRankTier(rank: number, total: number): SalesRepRankTier | null {
  if (total <= 1) return null
  if (total === 2) return rank === 0 ? 'green' : 'red'
  if (rank === 0) return 'green'
  if (rank === 1) return 'yellow'
  if (rank === 2) return 'orange'
  return 'red'
}

type MonthlyCountCustomer = {
  source: string
  sales_rep: number | null
  sales_rep_name: string | null
  created_date: string
  invalid_lead: string | null
}

const TAB_SOURCE: Record<string, string> = {
  walkin: 'check-in',
  leads: 'leads',
  'call-in': 'call-in',
}

const ALL_TAB_SOURCES = new Set(['check-in', 'call-in', 'leads'])

const TAB_LABEL: Record<string, string> = {
  all: 'Customers this month:',
  walkin: 'Walk-ins this month:',
  leads: 'Leads this month:',
  'call-in': 'Call-ins this month:',
}

export function getMonthlyCountLabel(tab: string): string | null {
  return TAB_LABEL[tab] ?? null
}

export function getMonthlyCountRankTooltipLines(): string[] {
  return [
    'Sales rep names are colored by rank for this month and the selected tab.',
    'Green — fewest customers. Yellow — second. Orange — third. Red — fourth or more (most).',
    'When counts are tied, the rep whose most recently added customer came in earlier ranks higher.',
  ]
}

export function computeMonthlyCountsBySalesRep(
  customers: MonthlyCountCustomer[],
  tab: string,
  referenceDate = new Date(),
): SalesRepMonthCount[] {
  const source = TAB_SOURCE[tab]
  if (tab !== 'all' && !source) return []

  const year = referenceDate.getFullYear()
  const month = referenceDate.getMonth()
  const excludeInvalid = tab === 'walkin' || tab === 'call-in'
  const counts = new Map<
    number,
    { salesRepName: string; count: number; mostRecentDate: number }
  >()

  for (const customer of customers) {
    if (tab === 'all') {
      if (!ALL_TAB_SOURCES.has(customer.source)) continue
    } else if (customer.source !== source) {
      continue
    }
    if (!customer.sales_rep) continue
    if (excludeInvalid && customer.invalid_lead) continue

    const created = new Date(customer.created_date)
    if (created.getFullYear() !== year || created.getMonth() !== month) continue

    const createdTime = created.getTime()
    const existing = counts.get(customer.sales_rep)
    if (existing) {
      existing.count += 1
      if (createdTime > existing.mostRecentDate) {
        existing.mostRecentDate = createdTime
      }
      continue
    }

    counts.set(customer.sales_rep, {
      salesRepName: customer.sales_rep_name ?? 'Unknown',
      count: 1,
      mostRecentDate: createdTime,
    })
  }

  const ranked = [...counts.entries()]
    .map(([salesRepId, value]) => ({
      salesRepId,
      salesRepName: value.salesRepName,
      count: value.count,
      mostRecentDate: value.mostRecentDate,
    }))
    .sort(
      (a, b) =>
        a.count - b.count ||
        a.mostRecentDate - b.mostRecentDate ||
        a.salesRepName.localeCompare(b.salesRepName),
    )

  const rankTierBySalesRepId = new Map<number, SalesRepRankTier | null>()
  ranked.forEach((entry, index) => {
    rankTierBySalesRepId.set(
      entry.salesRepId,
      getSalesRepRankTier(index, ranked.length),
    )
  })

  return ranked
    .map(entry => ({
      salesRepId: entry.salesRepId,
      salesRepName: entry.salesRepName,
      count: entry.count,
      mostRecentDate: entry.mostRecentDate,
      rankTier: rankTierBySalesRepId.get(entry.salesRepId) ?? null,
    }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        a.mostRecentDate - b.mostRecentDate ||
        a.salesRepName.localeCompare(b.salesRepName),
    )
    .map(({ mostRecentDate: _mostRecentDate, ...entry }) => entry)
}
