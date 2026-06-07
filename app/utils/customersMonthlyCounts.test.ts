import { describe, expect, it } from 'vitest'
import {
  computeMonthlyCountsBySalesRep,
  getMonthlyCountLabel,
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
      { salesRepId: 1, salesRepName: 'Alice', count: 2 },
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
      [{ salesRepId: 3, salesRepName: 'Cara', count: 1 }],
    )
    expect(computeMonthlyCountsBySalesRep(customers, 'leads', referenceDate)).toEqual([
      { salesRepId: 4, salesRepName: 'Dan', count: 1 },
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
      { salesRepId: 3, salesRepName: 'Cara', count: 1 },
    ])
  })

  it('counts all customers for the all tab', () => {
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
    ]

    expect(computeMonthlyCountsBySalesRep(customers, 'all', referenceDate)).toEqual([
      { salesRepId: 1, salesRepName: 'Alice', count: 2 },
      { salesRepId: 2, salesRepName: 'Bob', count: 1 },
    ])
  })
})

describe('getMonthlyCountLabel', () => {
  it('returns the label for supported tabs', () => {
    expect(getMonthlyCountLabel('all')).toBe('Total customers this month:')
    expect(getMonthlyCountLabel('call-in')).toBe('Call-ins this month:')
    expect(getMonthlyCountLabel('leads')).toBe('Leads this month:')
    expect(getMonthlyCountLabel('other')).toBeNull()
  })
})
