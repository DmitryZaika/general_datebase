import { z } from 'zod'

export const dealsSchema = z.object({
  company_id: z.coerce.number().optional(),
  amount: z.coerce.number().optional(),
  description: z.string().nullish(),
  customer_id: z.coerce
    .number({
      required_error: 'Please add a customer',
      invalid_type_error: 'Please add a customer',
    })
    .min(1, 'Please add a customer'),
  status: z.string().nullish(),
  list_id: z.coerce.number(),
  position: z.number(),
  user_id: z.coerce.number(),
})

export type DealsDialogSchema = z.infer<typeof dealsSchema>
