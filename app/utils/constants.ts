export const DONE_KEY = '[DONE]035d8eba-9f8c-44c5-a1e0-290d1da033f7[/DONE]'

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

type BasePriceProps = { linearFeet: number; squareFeet: number }

export const BASE_PRICES = {
  mitered_edge_price: 200,
  corbels_price: (corbels: number) => corbels * 100,
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
    'stone_t/o': ({ squareFeet }: BasePriceProps) => squareFeet * 10,
    'laminate_t/o': ({ squareFeet }: BasePriceProps) =>
      squareFeet < 40 ? 200 : squareFeet < 55 ? 250 : squareFeet < 70 ? 300 : 350,
    'vanity_t/o': 100,
  },
  stove_price: {
    'f/s': 0,
    's/i': 0,
    'c/t': 200,
    grill: 200,
    'n/a': 0,
  },
}

export const CUSTOMER_ITEMS = {
  tripFee: {
    miles: 'number',
    priceFn: ({ miles }: Record<string, number>) => miles * 4,
  },
  oversize_piece: {
    sqft: {
      '20+ sqft': 200,
      '40+ sqft': 400,
      '50+ sqft': 500,
    },
    priceFn: ({ sqft }: Record<string, number>) => sqft,
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
    edge_type: {
      flat: 0,
      eased: 100,
      '1/4_bevel': 200,
      '1/2_bevel': 199,
      ogee: ({ linearFeet }: { linearFeet: number }) => linearFeet * 25,
      bullnose: ({ linearFeet }: { linearFeet: number }) => linearFeet * 18,
    },
    linear_feet: 'number',
    priceFn: ({ edge_type, linear_feet }: Record<string, number | string>) => {
      if (!edge_type) return 0
      // TODO: remove eval
      // biome-ignore lint/security/noGlobalEval: Its safe
      const value = eval(edge_type)
      if (typeof value === 'function') {
        return value({ linearFeet: linear_feet })
      }
      return value
    },
  },
}
export const STONE_FINISHES = ['polished', 'leathered', 'honed'] as const
