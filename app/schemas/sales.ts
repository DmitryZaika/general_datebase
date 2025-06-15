import { z } from "zod";
import { coerceNumberRequired, StringOrNumber } from "~/schemas/general";

const slabOptionsSchema = z.object({
  id: z.coerce.number(),
  is_full: z.boolean(),
});

const sinkOptionsSchema = z.object({
  id: z.coerce.number(),
});

const faucetOptionsSchema = z.object({
  id: z.coerce.number(),
});

export const roomSchema = z.object({
  room: z.string().default("kitchen"),
  sink_type: z.array(sinkOptionsSchema).default([]),
  faucet_type: z.array(faucetOptionsSchema).default([]),
  edge: z.string().default("Flat"),
  backsplash: z.string().default("No"),
  square_feet: z.coerce.number().default(0),
  retail_price: z.coerce.number().optional(),
  total_price: z.coerce.number().optional(),
  tear_out: z.string().default("No"),
  stove: z.string().default("F/S"),
  waterfall: z.string().default("No"),
  corbels: z.coerce.number().default(0),
  seam: z.string().default("Standard"),
  ten_year_sealer: z.boolean().default(false),
  slabs: z.array(slabOptionsSchema).default([]),
  extras: z
    .record(
      z.string(),
      z.union([z.record(z.string(), z.any()), z.coerce.number()])
    )
    .default({}),
});

export const customerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  customer_id: z.coerce.number().optional(),
  seller_id: z.coerce.number().min(1, "Sales rep is required").optional(),
  billing_address: z.string().min(10, "Billing address is required"),
  billing_zip_code: z.coerce.string().optional(),
  project_address: z.string().min(10, "Project address is required"),
  same_address: z.boolean().default(true),
  phone: z
    .string()
    .regex(/^\d{3}-\d{3}-\d{4}$/, "Required format: 317-316-1456"),
  email: z.string().email("Please enter a valid email"),
  price: coerceNumberRequired("Please Enter Price"),
  notes_to_sale: StringOrNumber,

  rooms: z.array(roomSchema).default([]),
});

export type TCustomerSchema = z.infer<typeof customerSchema>;
