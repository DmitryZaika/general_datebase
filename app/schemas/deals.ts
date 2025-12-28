import { z } from 'zod'

export const dealsSchema = z.object({
  company_id: z.coerce.number().optional(),
  amount: z.coerce.number().optional(),
  description: z.string().nullish(),
  customer_id: z.coerce
    .number({
      error: issue =>
        issue.input === undefined ? 'Please add a customer' : 'Please add a customer',
    })
    .min(1, 'Please add a customer'),
  status: z.string().nullish(),
  list_id: z.coerce.number(),
  position: z.number(),
  user_id: z.coerce.number(),
  deal_id: z.coerce.number().optional(),
})

export type DealsDialogSchema = z.infer<typeof dealsSchema>
