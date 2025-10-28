import type { Value } from 'expr-eval'
import { Parser } from 'expr-eval'

type EvalScope = { [key: string]: Value }

const parser = new Parser({
  allowMemberAccess: false,
})

export const DONE_KEY = '[DONE]035d8eba-9f8c-44c5-a1e0-290d1da033f7[/DONE]'

export const LOST_REASONS = {
  'Too expensive': 'Too expensive',
  'Out of area': 'Out of area',
  'Never responded': 'Never responded',
  'Wrong number, email, etc.': 'Wrong number, email, etc.',
  'Accident submission': 'Accident submission',
  'Looking for unrelated service': 'Looking for unrelated service',
  'Bought somewhere else': 'Bought somewhere else',
  'Stopped responding': 'Stopped responding',
}

export const STONE_TYPES = [
  'granite',
  'quartz',
  'marble',
  'dolomite',
  'quartzite',
] as const

export const SINK_TYPES = [
  'stainless 18 gauge',
  'stainless 16 gauge',
  'composite',
  'ceramic',
  'farm house',
] as const

export const HARDCODED_IGNORES = [
  'edge_price',
  'tear_out_price',
  'stove_price',
  'waterfall_price',
  'corbels_price',
  'seam_price',
]

export const FAUCET_TYPES = ['single handle', 'double handle'] as const

// type BasePriceProps = { linearFeet: number; squareFeet: number }

function arrowToExpr(src: string): string {
  const s = src.trim()

  // Grab the arrow body
  const m = s.match(/=>\s*([\s\S]*)$/)
  if (!m) throw new Error('Not an arrow function')

  let body = m[1].trim()

  // If body is a block, pull the returned expression
  if (body.startsWith('{')) {
    // Single-return body: { return <expr>; }
    const ret = body.match(/^\{\s*return\s+([\s\S]*?);?\s*\}$/)
    if (!ret) {
      throw new Error('Only single-return block bodies are supported')
    }
    body = ret[1].trim()
  }

  // Drop trailing semicolons
  body = body.replace(/;+\s*$/, '')

  return body
}

export function compileArrowFunctionExpr(src: string) {
  const expr = arrowToExpr(src) // e.g., "squareFeet * 10"
  const ast = parser.parse(expr)
  return (params: EvalScope) => Number(ast.evaluate(params) ?? 0)
}

const COMPANY_1_BASE_PRICES = {
  mitered_edge_price: 200,
  corbels_price: '(corbels) => corbels * 100',
  seam_price: {
    standard: 0,
    extended: 0,
    no_seam: 0,
    european: 0,
    phantom: 250,
  },
  waterfall_price: {
    yes: 400,
    no: 0,
  },
  tear_out_price: {
    no: 0,
    'stone_t/o': '({ squareFeet }) => squareFeet * 10',
    'laminate_t/o':
      '({ squareFeet }) => squareFeet < 40 ? 200 : squareFeet < 55 ? 250 : squareFeet < 70 ? 300 : 350',
    'vanity_t/o': 100,
  },
  stove_price: {
    'f/s': 0,
    's/i': 0,
    'c/t': 200,
    grill: 200,
    'n/a': 0,
  },
  oversize_piece: {
    '20+ sqft': 200,
    '40+ sqft': 400,
    '50+ sqft': 500,
  },
  edge_type: {
    flat: 0,
    eased: 100,
    '1/4_bevel': 200,
    '1/2_bevel': 200,
    ogee: '({ linearFeet }) => linearFeet * 25',
    bullnose: '({ linearFeet }) => linearFeet * 18',
  },
}

function isArrowLike(src: string): boolean {
  // cheap heuristics so we don't try to parse plain labels like "yes"/"no"
  // You can tighten this if needed.
  return src.includes("=>");
}

type Compiled<T> =
  T extends string
    ? string | ((params: EvalScope) => number)
    : T extends Array<infer U>
      ? Array<Compiled<U>>
      : T extends object
        ? { [K in keyof T]: Compiled<T[K]> }
        : T

/*
function compileNested(value: string): string | ((params: EvalScope) => number)
function compileNested<T>(value: T[]): Array<Compiled<T>>
function compileNested<T extends object>(value: T): { [K in keyof T]: Compiled<T[K]> }
*/

function compileNested(value: unknown): unknown {
  if (typeof value === 'string') {
    if (!isArrowLike(value)) return value
    try {
      return compileArrowFunctionExpr(value)
    } catch {
      return value
    }
  }
  if (Array.isArray(value)) {
    return value.map(compileNested)
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = compileNested(v)
    }
    return out
  }
  return value
}

const BASE_PRICES = compileNested(COMPANY_1_BASE_PRICES)

export const CUSTOMER_ITEMS = {
  tripFee: {
    miles: 'number',
    priceFn: ({ miles }: Record<string, number>) => miles * 4,
  },
  oversize_piece: {
    sqft: BASE_PRICES.oversize_piece,
    priceFn: ({ sqft }: { sqft: keyof typeof BASE_PRICES.oversize_piece }) =>
      BASE_PRICES.oversize_piece[sqft],
  },
  mitter_edge_price: {
    amount: 'number',
    priceFn: ({ amount }: Record<string, number>) => amount * 200,
  },

  ten_year_sealer: {
    amount: 'number',
    priceFn: ({ amount }: Record<string, number>) => amount * 6,
  },
  sink_cut_out: {
    priceFn: ({ price }: Record<string, number>) => price || 250,
  },
  adjustment: {
    adjustment: 'string',
    priceFn: ({ price }: Record<string, number>) => price,
  },
  edge_price: {
    edge_type: BASE_PRICES.edge_type,
    linear_feet: 'number',
    priceFn: (
      { edge_type, linear_feet }: { edge_type: keyof typeof BASE_PRICES.edge_type; linear_feet: number | string }
    ) => {
      const edgeType = BASE_PRICES.edge_type[edge_type]
      if (typeof edgeType === 'function') {
        return edgeType({ linearFeet: Number(linear_feet) })
      }
      return edgeType
    },
  },
}
export const STONE_FINISHES = ['polished', 'leathered', 'honed'] as const
