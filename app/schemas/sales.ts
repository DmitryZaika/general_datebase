import { v7 as uuidv7 } from 'uuid'
import { z } from 'zod'
import { StringOrNumber } from '~/schemas/general'

export const slabOptionsSchema = z.object({
  id: z.coerce.number(),
  is_full: z.boolean(),
})

const sinkOptionsSchema = z.object({
  id: z.coerce.number(),
})

const faucetOptionsSchema = z.object({
  id: z.coerce.number(),
})

export const extrasSchema = z.record(
  z.string(),
  z.union([z.record(z.string(), z.any()), z.coerce.number()]),
)

export type TExtrasSchema = z.infer<typeof extrasSchema>

export const roomSchema = z.object({
  room: z.string().default('kitchen'),
  room_id: z.string().default(uuidv7),
  sink_type: z.array(sinkOptionsSchema).default([]),
  faucet_type: z.array(faucetOptionsSchema).default([]),
  edge: z.string().default('Flat'),
  backsplash: z.string().default('No'),
  square_feet: z.coerce.number().default(0),
  retail_price: z.coerce.number().default(0),
  total_price: z.coerce.number().optional(),
  tear_out: z.string().default('No'),
  stove: z.string().default('F/S'),
  waterfall: z.string().default('No'),
  corbels: z.coerce.number().default(0),
  seam: z.string().default('Standard'),
  ten_year_sealer: z.boolean().default(false),
  slabs: z.array(slabOptionsSchema).default([]),

  extras: extrasSchema.default({
    edge_price: 0,
    tear_out_price: 0,
    stove_price: 0,
    waterfall_price: 0,
    corbels_price: 0,
    seam_price: 0,
  }),
})

export const customerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  customer_id: z.coerce.number().optional(),
  seller_id: z.coerce.number().min(1, 'Sales rep is required').optional(),
  billing_address: z.string().min(10, 'Billing address is required'),
  billing_zip_code: z.coerce.string().optional(),
  project_address: z.string().min(10, 'Project address is required').nullable(),
  same_address: z.boolean().default(true),
  phone: z.string().regex(/^\d{3}-\d{3}-\d{4}$/, 'Required format: 317-316-1456'),
  email: z.string().email('Please enter a valid email'),
  notes_to_sale: StringOrNumber,
  price: z.coerce.number().default(0),
  builder: z.boolean().default(false),
  company_name: z.string().optional(),
  rooms: z.array(roomSchema).default([]),
})

export type TCustomerSchema = z.infer<typeof customerSchema>
