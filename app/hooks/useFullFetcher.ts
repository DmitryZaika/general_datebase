import type { FieldValues, UseFormReturn } from 'react-hook-form'
import { useFetcher } from 'react-router'
import { useAuthenticityToken } from 'remix-utils/csrf/react'

export function useFullFetcher<TFieldValues extends FieldValues = FieldValues>(
  form: UseFormReturn<TFieldValues>,
  action: undefined | string = undefined,
  method: 'POST' | 'DELETE' | 'PUT' = 'POST',
) {
  const fetcher = useFetcher()
  const token = useAuthenticityToken()

  const toFormData = (data: Record<string, unknown>) => {
    const fd = new FormData()
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined || value === null) continue
      fd.append(key, String(value))
    }
    return fd
  }

  const fullSubmit = form.handleSubmit(async data => {
    const payload = { ...data, csrf: token } as Record<string, unknown>
    const formData = toFormData(payload)

    await fetcher.submit(formData, {
      method: method,
      action: action,
      encType: 'multipart/form-data',
    })
  })

  return { fullSubmit, fetcher }
}
