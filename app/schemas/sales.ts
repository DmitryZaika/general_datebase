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
  room: z.string().prefault('kitchen'),
  room_id: z.string().prefault(uuidv7),
  stone_id: z.coerce.number().optional(),
  sink_type: z.array(sinkOptionsSchema).prefault([]),
  faucet_type: z.array(faucetOptionsSchema).prefault([]),
  backsplash: z.string().prefault('no'),
  square_feet: z.preprocess(
    value => (value === '' || value === null ? undefined : value),
    z.coerce.number().optional(),
  ),
  retail_price: z.coerce.number().prefault(0),
  total_price: z.coerce.number().optional(),
  tear_out: z.string().prefault('no'),
  stove: z.string().prefault('f/s'),
  waterfall: z.string().prefault('no'),
  corbels: z.coerce.number().prefault(0),
  seam: z.string().prefault('standard'),
  ten_year_sealer: z.boolean().prefault(false),
  slabs: z.array(slabOptionsSchema).prefault([]),
  extras: extrasSchema.prefault(EXTRA_DEFAULTS),
})

export type TRoomSchema = z.infer<typeof roomSchema>

export const finalExtrasSchema = z.object({
  adjustment: z.string().prefault(''),
  price: z.coerce.number().prefault(0),
})

export type TFullExtrasSchema = z.infer<typeof finalExtrasSchema>[]

export const customerSchema = z.object({
  customer_id: z.coerce
    .number({
        error: (issue) => issue.input === undefined ? 'Please add a customer' : 'Please add a customer'
    })
    .min(1, 'Please add a customer'),
  seller_id: z.coerce.number().min(1, 'Sales rep is required').optional(),
  project_address: z.string().optional().nullable(),
  notes_to_sale: StringOrNumber,
  price: z.coerce.number().prefault(0),
  company_name: z.string().nullable().optional(),
  rooms: z.array(roomSchema).prefault([]),
  extras: z.array(finalExtrasSchema).prefault([]),
}).superRefine((value, ctx) => {
  value.rooms.forEach((room, index) => {
    if (!room.square_feet || room.square_feet <= 0) {
      ctx.addIssue({
        code: "custom",
        message: 'Square feet is required',
        path: ['rooms', index, 'square_feet'],
      })
    }
  })
})

export type TCustomerSchema = z.infer<typeof customerSchema>
