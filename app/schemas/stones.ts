import { z } from 'zod'
import { STONE_FINISHES, STONE_TYPES } from '~/utils/constants'
import { coerceNumber, NullableId, StringBoolean } from './general'

export const stoneSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(STONE_TYPES),
  is_display: StringBoolean,
  on_sale: StringBoolean,
  regular_stock: StringBoolean,
  length: coerceNumber,
  width: coerceNumber,
  supplier_id: NullableId,
  bundle: z.string().optional(),
  cost_per_sqft: coerceNumber,
  retail_price: coerceNumber,
  level: NullableId,
  colors: z.any().optional(),
  finishing: z.enum(STONE_FINISHES),
})

const quickAddStoneBaseSchema = {
  name: z.string().min(1, 'Name is required'),
  retail_price: z.coerce.number().positive('Price is required'),
  length: z.coerce.number().positive('Length is required'),
  width: z.coerce.number().positive('Width is required'),
  type: z.enum(STONE_TYPES).optional(),
  company_id: z.number(),
}

export const quickAddStoneFormSchema = z
  .object({
    ...quickAddStoneBaseSchema,
    leftover: z.boolean(),
    bundles: z.array(z.object({ value: z.string() })),
  })
  .refine(
    data => {
      if (!data.leftover) {
        const nonEmptyBundles = data.bundles.filter(b => b.value.trim().length > 0)
        return nonEmptyBundles.length > 0
      }
      return true
    },
    {
      path: ['bundles'],
      error: 'At least one bundle number is required',
    },
  )
  .refine(
    data => {
      if (!data.leftover) {
        return data.bundles.every(b => b.value.trim().length > 0)
      }
      return true
    },
    {
      path: ['bundles'],
      error: 'All bundle numbers must be filled',
    },
  )

export const quickAddStoneSchema = z.discriminatedUnion('leftover', [
  z.object({
    ...quickAddStoneBaseSchema,
    leftover: z.literal(true),
  }),
  z.object({
    ...quickAddStoneBaseSchema,
    leftover: z.literal(false),
    bundles: z
      .array(z.string().min(1, 'Bundle number is required'))
      .min(1, 'At least one bundle is required'),
  }),
])

export type TQuickAddStoneSchema = z.infer<typeof quickAddStoneSchema>
export type TQuickAddStoneFormSchema = z.infer<typeof quickAddStoneFormSchema>

export type TLeftoverStone = Extract<TQuickAddStoneSchema, { leftover: true }>
export type TRegularStone = Extract<TQuickAddStoneSchema, { leftover: false }>

export const stoneFilterSchema = z.object({
  type: z.array(z.enum(STONE_TYPES)).prefault([]),
  show_sold_out: z
    .preprocess(value => {
      if (typeof value === 'boolean') return value
      return value === 'true'
    }, z.boolean())
    .prefault(false),
  supplier: z.number().gte(0).prefault(0),
  colors: z.any().optional(),
  level: z.array(z.number()).prefault([]),
  finishing: z.array(z.enum(STONE_FINISHES)).prefault([]),
  viewMode: z.enum(['grid', 'table']).optional().prefault('grid'),
})
export type StoneFilter = z.infer<typeof stoneFilterSchema>
