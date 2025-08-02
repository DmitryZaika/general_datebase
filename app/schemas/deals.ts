import { z } from 'zod'

export const dealsSchema = z.object({
  company_id: z.coerce.number().optional(),
  name: z.string().min(1, 'Name is required'),
  amount: z.coerce.number().optional(),
  description: z.string().default(' '),
  customer_id: z.number(),
  status: z.string(),
  list_id: z.coerce.number(),
  position: z.number(),
})

export type DealsDialogSchema = z.infer<typeof dealsSchema>

export const dealListSchema = z.object({
  name: z.string().min(1, 'Name is required'),
})

export type DealListSchema = z.infer<typeof dealListSchema>
