import { z } from 'zod'
import { FAUCET_TYPES } from '~/utils/constants'
import { NullableId, StringBoolean } from './general'

export const faucetSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(FAUCET_TYPES),
  supplier_id: NullableId,
  amount: z.coerce.number().prefault(0),
  cost: z.coerce.number().prefault(0),
  retail_price: z.coerce.number().prefault(0),
  is_display: StringBoolean,
  regular_stock: StringBoolean,
})

export const faucetFilterSchema = z.object({
  type: z.array(z.enum(FAUCET_TYPES)).prefault([]),
  show_sold_out: z
    .preprocess(value => {
      if (typeof value === 'boolean') return value
      return value === 'true'
    }, z.boolean())
    .prefault(false),
  supplier: z
    .preprocess(value => {
      if (typeof value === 'number') return value
      if (typeof value === 'string') return Number(value)
      return 0
    }, z.number().gte(0))
    .prefault(0),
})

export type FaucetFilter = z.infer<typeof faucetFilterSchema>
