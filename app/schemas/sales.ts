import { v7 as uuidv7 } from 'uuid'
import { z } from 'zod'
import { StringOrNumber } from '~/schemas/general'

export const slabOptionsSchema = z.object({
  id: z.coerce.number(),
  is_full: z.boolean(),
})

const sinkOptionsSchema = z.object({
  id: z.coerce.number().optional(),
  type_id: z.coerce.number(),
  price: z.coerce.number(),
})

const faucetOptionsSchema = z.object({
  id: z.coerce.number().optional(),
  type_id: z.coerce.number(),
  price: z.coerce.number(),
})

export const extrasSchema = z.record(
  z.string(),
  z.union([z.record(z.string(), z.any()), z.coerce.number()]),
)

export type TExtrasSchema = z.infer<typeof extrasSchema>

export const EXTRA_DEFAULTS = {
  edge_price: {
    edge_type: 'flat',
    price: 0,
  },
  tear_out_price: 0,
  stove_price: 0,
  waterfall_price: 0,
  corbels_price: 0,
  seam_price: 0,
}

export const roomSchema = z.object({
  room: z.string().default('kitchen'),
  room_id: z.string().default(uuidv7),
  stone_id: z.coerce.number().optional(),
  sink_type: z.array(sinkOptionsSchema).default([]),
  faucet_type: z.array(faucetOptionsSchema).default([]),
  backsplash: z.string().default('no'),
  square_feet: z.preprocess(
    value => (value === '' || value === null ? undefined : value),
    z.coerce.number().optional(),
  ),
  retail_price: z.coerce.number().default(0),
  total_price: z.coerce.number().optional(),
  tear_out: z.string().default('no'),
  stove: z.string().default('f/s'),
  waterfall: z.string().default('no'),
  corbels: z.coerce.number().default(0),
  seam: z.string().default('standard'),
  ten_year_sealer: z.boolean().default(false),
  slabs: z.array(slabOptionsSchema).default([]),
  extras: extrasSchema.default(EXTRA_DEFAULTS),
})

export type TRoomSchema = z.infer<typeof roomSchema>

export const finalExtrasSchema = z.object({
  adjustment: z.string().default(''),
  price: z.coerce.number().default(0),
})

export type TFullExtrasSchema = z.infer<typeof finalExtrasSchema>[]

export const customerSchema = z.object({
  customer_id: z.coerce
    .number({
      required_error: 'Please add a customer',
      invalid_type_error: 'Please add a customer',
    })
    .min(1, 'Please add a customer'),
  seller_id: z.coerce.number().min(1, 'Sales rep is required').optional(),
  project_address: z.string().optional().nullable(),
  notes_to_sale: StringOrNumber,
  price: z.coerce.number().default(0),
  company_name: z.string().nullable().optional(),
  rooms: z.array(roomSchema).default([]),
  extras: z.array(finalExtrasSchema).default([]),
}).superRefine((value, ctx) => {
  value.rooms.forEach((room, index) => {
    if (!room.square_feet || room.square_feet <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Square feet is required',
        path: ['rooms', index, 'square_feet'],
      })
    }
  })
})

export type TCustomerSchema = z.infer<typeof customerSchema>
