import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

export const checklistSchema = z.object({
  customer_name: z.string().min(1, 'Required'),
  installation_address: z.string().min(1, 'Required'),
  email: z
    .string()
    .trim()
    .email('Invalid email')
    .optional()
    .or(z.literal(''))
    .nullable(),
  material_correct: z.union([z.literal('on'), z.literal('')]).optional(),
  seams_satisfaction: z.union([z.literal('on'), z.literal('')]).optional(),
  appliances_fit: z.union([z.literal('on'), z.literal('')]).optional(),
  backsplashes_correct: z.union([z.literal('on'), z.literal('')]).optional(),
  edges_correct: z.union([z.literal('on'), z.literal('')]).optional(),
  holes_drilled: z.union([z.literal('on'), z.literal('')]).optional(),
  cleanup_completed: z.union([z.literal('on'), z.literal('')]).optional(),
  comments: z.string().optional(),
  signature: z.string().min(1, 'Signature is required'),
  customer_id: z.number().nullable().prefault(null),
})

export type ChecklistFormData = z.infer<typeof checklistSchema>

export const checklistResolver = zodResolver(checklistSchema)
