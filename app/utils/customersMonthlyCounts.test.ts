import { describe, expect, it } from 'vitest'
import {
  computeMonthlyCountsBySalesRep,
  getMonthlyCountLabel,
  getMonthlyCountRankTooltipLines,
  getSalesRepRankTierColorClass,
} from './customersMonthlyCounts'

const referenceDate = new Date('2026-06-15T12:00:00.000Z')

describe('computeMonthlyCountsBySalesRep', () => {
  it('counts walk-ins for the current month by sales rep', () => {
    const customers = [
      {
        source: 'check-in',
        sales_rep: 1,
        sales_rep_name: 'Alice',
        created_date: '2026-06-02T10:00:00.000Z',
        invalid_lead: null,
      },
      {
        source: 'check-in',
        sales_rep: 1,
        sales_rep_name: 'Alice',
        created_date: '2026-06-10T10:00:00.000Z',
        invalid_lead: null,
      },
      {
        source: 'check-in',
        sales_rep: 2,
        sales_rep_name: 'Bob',
        created_date: '2026-05-10T10:00:00.000Z',
        invalid_lead: null,
      },
    ]

    expect(computeMonthlyCountsBySalesRep(customers, 'walkin', referenceDate)).toEqual([
      { salesRepId: 1, salesRepName: 'Alice', count: 2, rankTier: null },
    ])
  })

  it('counts call-ins and leads for the active tab', () => {
    const customers = [
      {
        source: 'call-in',
        sales_rep: 3,
        sales_rep_name: 'Cara',
        created_date: '2026-06-04T10:00:00.000Z',
        invalid_lead: null,
      },
      {
        source: 'leads',
        sales_rep: 4,
        sales_rep_name: 'Dan',
        created_date: '2026-06-04T10:00:00.000Z',
        invalid_lead: null,
      },
    ]

    expect(computeMonthlyCountsBySalesRep(customers, 'call-in', referenceDate)).toEqual(
      [{ salesRepId: 3, salesRepName: 'Cara', count: 1, rankTier: null }],
    )
    expect(computeMonthlyCountsBySalesRep(customers, 'leads', referenceDate)).toEqual([
      { salesRepId: 4, salesRepName: 'Dan', count: 1, rankTier: null },
    ])
  })

  it('respects the sales rep filter via the provided customer list', () => {
    const customers = [
      {
        source: 'call-in',
        sales_rep: 3,
        sales_rep_name: 'Cara',
        created_date: '2026-06-04T10:00:00.000Z',
        invalid_lead: null,
      },
      {
        source: 'call-in',
        sales_rep: 5,
        sales_rep_name: 'Eve',
        created_date: '2026-06-05T10:00:00.000Z',
        invalid_lead: null,
      },
    ]

    const filtered = customers.filter(customer => customer.sales_rep === 3)
    expect(computeMonthlyCountsBySalesRep(filtered, 'call-in', referenceDate)).toEqual([
      { salesRepId: 3, salesRepName: 'Cara', count: 1, rankTier: null },
    ])
  })

  it('counts call-in, walk-in, and leads for the all tab', () => {
    const customers = [
      {
        source: 'check-in',
        sales_rep: 1,
        sales_rep_name: 'Alice',
        created_date: '2026-06-02T10:00:00.000Z',
        invalid_lead: null,
      },
      {
        source: 'call-in',
        sales_rep: 1,
        sales_rep_name: 'Alice',
        created_date: '2026-06-03T10:00:00.000Z',
        invalid_lead: null,
      },
      {
        source: 'leads',
        sales_rep: 2,
        sales_rep_name: 'Bob',
        created_date: '2026-06-04T10:00:00.000Z',
        invalid_lead: null,
      },
      {
        source: 'other',
        sales_rep: 3,
        sales_rep_name: 'Cara',
        created_date: '2026-06-05T10:00:00.000Z',
        invalid_lead: null,
      },
      {
        source: 'check-list',
        sales_rep: 4,
        sales_rep_name: 'Dan',
        created_date: '2026-06-06T10:00:00.000Z',
        invalid_lead: null,
      },
    ]

    expect(computeMonthlyCountsBySalesRep(customers, 'all', referenceDate)).toEqual([
      { salesRepId: 1, salesRepName: 'Alice', count: 2, rankTier: 'red' },
      { salesRepId: 2, salesRepName: 'Bob', count: 1, rankTier: 'green' },
    ])
  })

  it('assigns rank tiers by count and breaks ties by most recent customer date', () => {
    const customers = [
      {
        source: 'check-in',
        sales_rep: 1,
        sales_rep_name: 'Polina',
        created_date: '2026-06-01T10:00:00.000Z',
        invalid_lead: null,
      },
      {
        source: 'check-in',
        sales_rep: 2,
        sales_rep_name: 'Tania',
        created_date: '2026-06-05T10:00:00.000Z',
        invalid_lead: null,
      },
      {
        source: 'check-in',
        sales_rep: 3,
        sales_rep_name: 'Lisa',
        created_date: '2026-06-10T10:00:00.000Z',
        invalid_lead: null,
      },
      {
        source: 'check-in',
        sales_rep: 1,
        sales_rep_name: 'Polina',
        created_date: '2026-06-02T10:00:00.000Z',
        invalid_lead: null,
      },
      {
        source: 'check-in',
        sales_rep: 2,
        sales_rep_name: 'Tania',
        created_date: '2026-06-06T10:00:00.000Z',
        invalid_lead: null,
      },
      {
        source: 'check-in',
        sales_rep: 3,
        sales_rep_name: 'Lisa',
        created_date: '2026-06-11T10:00:00.000Z',
        invalid_lead: null,
      },
      {
        source: 'check-in',
        sales_rep: 1,
        sales_rep_name: 'Polina',
        created_date: '2026-06-03T10:00:00.000Z',
        invalid_lead: null,
      },
      {
        source: 'check-in',
        sales_rep: 2,
        sales_rep_name: 'Tania',
        created_date: '2026-06-07T10:00:00.000Z',
        invalid_lead: null,
      },
      {
        source: 'check-in',
        sales_rep: 3,
        sales_rep_name: 'Lisa',
        created_date: '2026-06-12T10:00:00.000Z',
        invalid_lead: null,
      },
    ]

    expect(computeMonthlyCountsBySalesRep(customers, 'walkin', referenceDate)).toEqual([
      { salesRepId: 1, salesRepName: 'Polina', count: 3, rankTier: 'green' },
      { salesRepId: 2, salesRepName: 'Tania', count: 3, rankTier: 'yellow' },
      { salesRepId: 3, salesRepName: 'Lisa', count: 3, rankTier: 'orange' },
    ])
  })

  it('assigns red to the sales rep with the newest customer among four tied reps', () => {
    const customers = [
      {
        source: 'call-in',
        sales_rep: 1,
        sales_rep_name: 'Polina',
        created_date: '2026-06-01T10:00:00.000Z',
        invalid_lead: null,
      },
      {
        source: 'call-in',
        sales_rep: 2,
        sales_rep_name: 'Tania',
        created_date: '2026-06-05T10:00:00.000Z',
        invalid_lead: null,
      },
      {
        source: 'call-in',
        sales_rep: 3,
        sales_rep_name: 'Lisa',
        created_date: '2026-06-10T10:00:00.000Z',
        invalid_lead: null,
      },
      {
        source: 'call-in',
        sales_rep: 4,
        sales_rep_name: 'Nina',
        created_date: '2026-06-15T10:00:00.000Z',
        invalid_lead: null,
      },
    ]

    expect(computeMonthlyCountsBySalesRep(customers, 'call-in', referenceDate)).toEqual([
      { salesRepId: 1, salesRepName: 'Polina', count: 1, rankTier: 'green' },
      { salesRepId: 2, salesRepName: 'Tania', count: 1, rankTier: 'yellow' },
      { salesRepId: 3, salesRepName: 'Lisa', count: 1, rankTier: 'orange' },
      { salesRepId: 4, salesRepName: 'Nina', count: 1, rankTier: 'red' },
    ])
  })

  it('assigns red to every sales rep ranked fourth or lower', () => {
    const customers = [
      {
        source: 'check-in',
        sales_rep: 1,
        sales_rep_name: 'Rep A',
        created_date: '2026-06-01T10:00:00.000Z',
        invalid_lead: null,
      },
      {
        source: 'check-in',
        sales_rep: 2,
        sales_rep_name: 'Rep B',
        created_date: '2026-06-02T10:00:00.000Z',
        invalid_lead: null,
      },
      {
        source: 'check-in',
        sales_rep: 3,
        sales_rep_name: 'Rep C',
        created_date: '2026-06-03T10:00:00.000Z',
        invalid_lead: null,
      },
      {
        source: 'check-in',
        sales_rep: 4,
        sales_rep_name: 'Rep D',
        created_date: '2026-06-04T10:00:00.000Z',
        invalid_lead: null,
      },
      {
        source: 'check-in',
        sales_rep: 5,
        sales_rep_name: 'Rep E',
        created_date: '2026-06-05T10:00:00.000Z',
        invalid_lead: null,
      },
      {
        source: 'check-in',
        sales_rep: 6,
        sales_rep_name: 'Rep F',
        created_date: '2026-06-06T10:00:00.000Z',
        invalid_lead: null,
      },
    ]

    expect(computeMonthlyCountsBySalesRep(customers, 'walkin', referenceDate)).toEqual([
      { salesRepId: 1, salesRepName: 'Rep A', count: 1, rankTier: 'green' },
      { salesRepId: 2, salesRepName: 'Rep B', count: 1, rankTier: 'yellow' },
      { salesRepId: 3, salesRepName: 'Rep C', count: 1, rankTier: 'orange' },
      { salesRepId: 4, salesRepName: 'Rep D', count: 1, rankTier: 'red' },
      { salesRepId: 5, salesRepName: 'Rep E', count: 1, rankTier: 'red' },
      { salesRepId: 6, salesRepName: 'Rep F', count: 1, rankTier: 'red' },
    ])
  })
})

describe('getSalesRepRankTierColorClass', () => {
  it('returns the tailwind text color for each rank tier', () => {
    expect(getSalesRepRankTierColorClass('green')).toBe('text-green-600')
    expect(getSalesRepRankTierColorClass('yellow')).toBe('text-yellow-600')
    expect(getSalesRepRankTierColorClass('orange')).toBe('text-orange-600')
    expect(getSalesRepRankTierColorClass('red')).toBe('text-red-600')
    expect(getSalesRepRankTierColorClass(null)).toBe('')
  })
})

describe('getMonthlyCountLabel', () => {
  it('returns the label for supported tabs', () => {
    expect(getMonthlyCountLabel('all')).toBe('Customers this month:')
    expect(getMonthlyCountLabel('call-in')).toBe('Call-ins this month:')
    expect(getMonthlyCountLabel('leads')).toBe('Leads this month:')
    expect(getMonthlyCountLabel('other')).toBeNull()
  })
})

describe('getMonthlyCountRankTooltipLines', () => {
  it('describes the rank color rules', () => {
    expect(getMonthlyCountRankTooltipLines()).toEqual([
      'Sales rep names are colored by rank for this month and the selected tab.',
      'Green — fewest customers. Yellow — second. Orange — third. Red — fourth or more (most).',
      'When counts are tied, the rep whose most recently added customer came in earlier ranks higher.',
    ])
  })
})
