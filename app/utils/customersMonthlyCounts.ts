export type SalesRepMonthCount = {
  salesRepId: number
  salesRepName: string
  count: number
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

const TAB_LABEL: Record<string, string> = {
  all: 'Customers this month:',
  walkin: 'Walk-ins this month:',
  leads: 'Leads this month:',
  'call-in': 'Call-ins this month:',
}

export function getMonthlyCountLabel(tab: string): string | null {
  return TAB_LABEL[tab] ?? null
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
  const counts = new Map<number, { salesRepName: string; count: number }>()

  for (const customer of customers) {
    if (tab !== 'all' && customer.source !== source) continue
    if (!customer.sales_rep) continue
    if (excludeInvalid && customer.invalid_lead) continue

    const created = new Date(customer.created_date)
    if (created.getFullYear() !== year || created.getMonth() !== month) continue

    const existing = counts.get(customer.sales_rep)
    if (existing) {
      existing.count += 1
      continue
    }

    counts.set(customer.sales_rep, {
      salesRepName: customer.sales_rep_name ?? 'Unknown',
      count: 1,
    })
  }

  return [...counts.entries()]
    .map(([salesRepId, value]) => ({
      salesRepId,
      salesRepName: value.salesRepName,
      count: value.count,
    }))
    .sort((a, b) => b.count - a.count || a.salesRepName.localeCompare(b.salesRepName))
}
