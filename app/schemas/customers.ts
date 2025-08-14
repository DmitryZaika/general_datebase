import { z } from 'zod'
import type { ToastProps } from '~/components/ui/toast'

type ToastFunction = (props: ToastProps & { description: string }) => void

export const sourceEnum = ['check-in', 'user-input', 'check-list'] as const

export const customerSignupSchema = z.object({
  company_id: z.number().min(1, 'Company ID is required'),
  name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  company_name: z.string().nullish(),
  referral_source: z
    .enum([
      'google',
      'facebook',
      'referral',
      'flyer',
      'drive-thru',
      'instagram',
      'other',
    ])
    .optional(),
  source: z.enum(sourceEnum),
})

export type CustomerSignupSchema = z.infer<typeof customerSignupSchema>

export const createCustomer = async (data: CustomerSignupSchema) => {
  const clean = customerSignupSchema.parse(data)
  const response = await fetch('/api/customers/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(clean),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `Request failed with ${response.status}`)
  }
  return response.json()
}

export const updateCustomer = async (id: number, data: CustomerSignupSchema) => {
  const clean = customerSignupSchema.parse(data)
  const response = await fetch(`/api/customers/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(clean),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `Request failed with ${response.status}`)
  }
  return response.json()
}

export const customerDialogSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.union([z.coerce.string().min(10), z.literal('')]),
  address: z.string().min(5, 'Address must be at least 5 characters long'),
  builder: z.boolean().default(false),
  company_name: z.string().nullish(),
})

export type CustomerDialogSchema = z.infer<typeof customerDialogSchema>

export const createCustomerMutation = (
  toast: ToastFunction,
  onSuccess?: (id: number) => void,
) => {
  return {
    mutationFn: createCustomer,
    onSuccess: (data: { customerId: number }) => {
      onSuccess?.(data.customerId)
    },
    onError: (error: unknown) => {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Something went wrong. Please try again.',
        variant: 'destructive',
      })
    },
  }
}

export const updateCustomerMutation = (
  toast: ToastFunction,
  onSuccess?: (id: number) => void,
) => {
  return {
    mutationFn: (data: CustomerSignupSchema & { id: number }) =>
      updateCustomer(data.id, data),
    onSuccess: (_: unknown, { id }: { id: number }) => {
      onSuccess?.(id)
    },
    onError: (error: unknown) => {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Something went wrong. Please try again.',
        variant: 'destructive',
      })
    },
  }
}
