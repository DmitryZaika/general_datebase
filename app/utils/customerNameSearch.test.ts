import { describe, expect, test } from 'vitest'
import {
  buildNameSearchLikeClause,
  levenshtein,
  matchesNameFuzzy,
} from './customerNameSearch.server'

describe('levenshtein', () => {
  test('allows one edit', () => {
    expect(levenshtein('john', 'jhon')).toBe(1)
    expect(levenshtein('smith', 'smiht')).toBe(1)
  })
})

describe('matchesNameFuzzy', () => {
  test('matches words in any order', () => {
    expect(matchesNameFuzzy('John Smith', 'Smith John')).toBe(true)
    expect(matchesNameFuzzy('John Smith', 'john smith')).toBe(true)
  })

  test('allows one typo per search word', () => {
    expect(matchesNameFuzzy('John Smith', 'Jhon')).toBe(true)
    expect(matchesNameFuzzy('John Smith', 'Jhon Smiht')).toBe(true)
    expect(matchesNameFuzzy('John Smith', 'Joan')).toBe(false)
  })

  test('matches company names', () => {
    expect(matchesNameFuzzy('Acme Kitchens', 'Acme Ktchens')).toBe(true)
  })
})

describe('buildNameSearchLikeClause', () => {
  test('builds multi-word clause with separate params', () => {
    const { clause, params } = buildNameSearchLikeClause('John Smith', 'c.name', 'c.company_name')
    expect(clause).toContain('c.name LIKE ?')
    expect(params[0]).toBe('%John Smith%')
    expect(params).toContain('%Joh%')
    expect(params).toContain('%Smi%')
  })
})
