import { z } from 'zod'

export const dealsSchema = z.object({
  company_id: z.coerce.number().optional(),
  amount: z.coerce.number().optional(),
  description: z.string().nullish(),
  customer_id: z.number(),
  status: z.string().nullish(),
  list_id: z.coerce.number(),
  position: z.number(),
  user_id: z.coerce.number(),
})

export type DealsDialogSchema = z.infer<typeof dealsSchema>
