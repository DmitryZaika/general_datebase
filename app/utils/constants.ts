import z from 'zod'

export const DIALOG_CONTENT_ADD_EDIT_CLASS =
  'sm:max-w-[480px] overflow-y-auto h-[95vh] flex flex-col'

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

export const getSearchString = (url: URL) => {
  const searchParams = url.searchParams.toString()
  return searchParams ? `?${searchParams}` : ''
}

export const zodEmail = z
  .email('Invalid email address')
  .transform(val => val?.trim().toLowerCase())

export const optionalEmailSchema = z.preprocess(
  val => (typeof val === 'string' && val.trim() === '' ? undefined : val),
  zodEmail.optional(),
)

export const dateClass = 'text-center text-xs text-gray-500 my-1'

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
    ogee: ({ linearFeet }: { linearFeet: number }) => linearFeet * 25,
    bullnose: ({ linearFeet }: { linearFeet: number }) => linearFeet * 18,
  },
}
export const fileSize = 'size-24'

export const CUSTOMER_ITEMS = {
  tripFee: {
    miles: 'number',
    priceFn: ({ miles }: Record<string, number>) => miles * 4,
  },
  oversize_piece: {
    sqft: BASE_PRICES.oversize_piece,
    priceFn: ({ sqft }: Record<string, number | string>) =>
      BASE_PRICES.oversize_piece[sqft as keyof typeof BASE_PRICES.oversize_piece],
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
    priceFn: ({ edge_type, linear_feet }: Record<string, number | string>) => {
      const edgeType =
        BASE_PRICES.edge_type[edge_type as keyof typeof BASE_PRICES.edge_type]
      if (typeof edgeType === 'function') {
        return edgeType({ linearFeet: Number(linear_feet) })
      }
      return edgeType
    },
  },
}
export const STONE_FINISHES = ['polished', 'leathered', 'honed'] as const
