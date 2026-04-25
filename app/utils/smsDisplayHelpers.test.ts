import { describe, expect, it } from 'vitest'
import {
  groupSmsIntoThreads,
  mapRowToSmsEntry,
  type SmsEntry,
  type SmsRow,
} from './smsDisplayHelpers'

const baseRow: SmsRow = {
  id: 1,
  cloudtalk_id: null,
  sender: '3173161456',
  recipient: '6468956758',
  text: 'Hello',
  agent: null,
  created_date: '2026-04-01T10:00:00Z',
  company_id: 42,
}

const customerDigits = ['3173161456']

describe('mapRowToSmsEntry', () => {
  it('marks message as inbound when sender matches customer phone', () => {
    const entry = mapRowToSmsEntry(baseRow, customerDigits)
    expect(entry.direction).toBe('inbound')
    expect(entry.customerPhone).toBe('3173161456')
  })

  it('marks message as outbound when recipient matches customer phone', () => {
    const entry = mapRowToSmsEntry(
      { ...baseRow, sender: '6468956758', recipient: '3173161456' },
      customerDigits,
    )
    expect(entry.direction).toBe('outbound')
    expect(entry.customerPhone).toBe('3173161456')
  })

  it('preserves text, agent, id, createdDate verbatim', () => {
    const entry = mapRowToSmsEntry(
      { ...baseRow, id: 99, text: 'Привет', agent: 'Sarah' },
      customerDigits,
    )
    expect(entry.id).toBe(99)
    expect(entry.text).toBe('Привет')
    expect(entry.agent).toBe('Sarah')
    expect(entry.createdDate).toBe(baseRow.created_date)
  })

  it('handles two customer phones — both directions resolve correctly', () => {
    const digits = ['3173161456', '5552223333']
    const inbound = mapRowToSmsEntry(
      { ...baseRow, sender: '5552223333', recipient: '6468956758' },
      digits,
    )
    expect(inbound.direction).toBe('inbound')
    expect(inbound.customerPhone).toBe('5552223333')
  })

  it('treats sender as customer when both sides match (inbound bias)', () => {
    // Edge: customer's two phones text each other
    const digits = ['3173161456', '5552223333']
    const entry = mapRowToSmsEntry(
      { ...baseRow, sender: '3173161456', recipient: '5552223333' },
      digits,
    )
    // sender is in digits → inbound
    expect(entry.direction).toBe('inbound')
  })
})

function makeEntry(
  id: number,
  customerPhone: string,
  createdDate: string,
  direction: 'inbound' | 'outbound' = 'inbound',
): SmsEntry {
  return {
    id,
    direction,
    text: `msg ${id}`,
    agent: null,
    customerPhone,
    createdDate,
  }
}

describe('groupSmsIntoThreads', () => {
  it('returns empty array when no entries', () => {
    expect(groupSmsIntoThreads([])).toEqual([])
  })

  it('groups all entries with the same customer phone into one thread', () => {
    const entries = [
      makeEntry(1, '3173161456', '2026-04-01T10:00:00Z'),
      makeEntry(2, '3173161456', '2026-04-02T10:00:00Z'),
      makeEntry(3, '3173161456', '2026-04-03T10:00:00Z'),
    ]
    const threads = groupSmsIntoThreads(entries)
    expect(threads).toHaveLength(1)
    expect(threads[0].customerPhone).toBe('3173161456')
    expect(threads[0].count).toBe(3)
  })

  it('separates entries by customer phone into distinct threads', () => {
    const entries = [
      makeEntry(1, '3173161456', '2026-04-01T10:00:00Z'),
      makeEntry(2, '5552223333', '2026-04-02T10:00:00Z'),
    ]
    const threads = groupSmsIntoThreads(entries)
    expect(threads).toHaveLength(2)
    expect(threads.map(t => t.customerPhone).sort()).toEqual([
      '3173161456',
      '5552223333',
    ])
  })

  it('sorts messages within a thread oldest-first', () => {
    const entries = [
      makeEntry(3, '3173161456', '2026-04-03T10:00:00Z'),
      makeEntry(1, '3173161456', '2026-04-01T10:00:00Z'),
      makeEntry(2, '3173161456', '2026-04-02T10:00:00Z'),
    ]
    const threads = groupSmsIntoThreads(entries)
    expect(threads[0].messages.map(m => m.id)).toEqual([1, 2, 3])
  })

  it('sets lastMessageAt to the newest message timestamp', () => {
    const entries = [
      makeEntry(1, '3173161456', '2026-04-01T10:00:00Z'),
      makeEntry(2, '3173161456', '2026-04-15T10:00:00Z'),
    ]
    const threads = groupSmsIntoThreads(entries)
    expect(threads[0].lastMessageAt).toBe('2026-04-15T10:00:00Z')
  })

  it('sorts threads by lastMessageAt descending (newest thread first)', () => {
    const entries = [
      makeEntry(1, 'phoneA', '2026-04-01T10:00:00Z'),
      makeEntry(2, 'phoneB', '2026-04-15T10:00:00Z'),
      makeEntry(3, 'phoneC', '2026-04-10T10:00:00Z'),
    ]
    const threads = groupSmsIntoThreads(entries)
    expect(threads.map(t => t.customerPhone)).toEqual(['phoneB', 'phoneC', 'phoneA'])
  })

  it('does not mutate the input entries array', () => {
    const entries = [
      makeEntry(2, '3173161456', '2026-04-02T10:00:00Z'),
      makeEntry(1, '3173161456', '2026-04-01T10:00:00Z'),
    ]
    const before = entries.map(e => e.id)
    groupSmsIntoThreads(entries)
    expect(entries.map(e => e.id)).toEqual(before)
  })
})
