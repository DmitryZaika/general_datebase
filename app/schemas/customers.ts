import { z } from 'zod'
import type { Toast } from '~/hooks/use-toast'

export const customerSignupSchema = z.object({
  company_id: z.number().min(1, 'Company ID is required'),
  name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
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
})

export type CustomerSignupSchema = z.infer<typeof customerSignupSchema>

export const createCustomer = async (data: CustomerSignupSchema) => {
  const clean = customerSignupSchema.parse(data)
  const response = await fetch('/api/customers/create', {
    method: 'POST',
    body: JSON.stringify(clean),
  })
  return response.json()
}

export const updateCustomer = async (id: number, data: CustomerSignupSchema) => {
  const clean = customerSignupSchema.parse(data)
  const response = await fetch(`/api/customers/${id}`, {
    method: 'POST',
    body: JSON.stringify(clean),
  })
  return response.json()
}

export const customerDialogSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.union([z.coerce.string().min(10), z.literal('')]),
  address: z.string().min(10, 'Address must be at least 10 characters long'),
})

export type CustomerDialogSchema = z.infer<typeof customerDialogSchema>

export const createCustomerMutation = (
  toast: Toast,
  onSuccess?: (id: number) => void,
) => {
  return {
    mutationFn: createCustomer,
    onSuccess: (data: { customerId: number }) => {
      onSuccess?.(data.customerId)
    },
    onError: error => {
      console.error('Error creating customer:', error)
      toast({
        title: 'Error',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      })
    },
  }
}

export const updateCustomerMutation = (
  toast: Toast,
  onSuccess?: (id: number) => void,
) => {
  return {
    mutationFn: (data: CustomerSignupSchema & { id: number }) =>
      updateCustomer(data.id, data),
    onSuccess: (_: unknown, { id }: { id: number }) => {
      onSuccess?.(id)
    },
    onError: error => {
      console.error('Error creating customer:', error)
      toast({
        title: 'Error',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      })
    },
  }
}
