import { z } from 'zod'

export const dealsSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  amount: z.coerce.number().min(1, 'Amount is required'),
  description: z.string().optional(),
  customer_id: z.number().optional(),
  status: z.string().optional(),
  list_id: z.coerce.number().optional(),
  position: z.number().optional(),
  is_deleted: z.boolean().optional(),
})

export type DealsDialogSchema = z.infer<typeof dealsSchema>

export const dealListSchema = z.object({
  name: z.string().min(1, 'Name is required'),
})

export type DealListSchema = z.infer<typeof dealListSchema>
