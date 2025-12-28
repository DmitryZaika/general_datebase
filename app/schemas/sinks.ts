import { z } from 'zod'
import { SINK_TYPES } from '~/utils/constants'
import { NullableId, StringBoolean } from './general'

export const sinkSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(SINK_TYPES),
  supplier_id: NullableId,
  length: z.coerce.number().prefault(0),
  width: z.coerce.number().prefault(0),
  amount: z.coerce.number().prefault(0),
  cost: z.coerce.number().prefault(0),
  retail_price: z.coerce.number().prefault(0),
  is_display: StringBoolean,
  regular_stock: StringBoolean,
})

export const sinkFilterSchema = z.object({
  type: z.array(z.enum(SINK_TYPES)).prefault([]),
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

export type SinkFilter = z.infer<typeof sinkFilterSchema>
