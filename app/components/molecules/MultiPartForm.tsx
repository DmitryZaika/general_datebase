import type { FieldValues, UseFormReturn } from 'react-hook-form'
import { Form, useSubmit } from 'react-router'
import { useAuthenticityToken } from 'remix-utils/csrf/react'
import { FormProvider } from '~/components/ui/form'

function createFromData(data: object) {
  const formData = new FormData()

  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      formData.append(key, JSON.stringify(value))
    } else {
      formData.append(key, value)
    }
  }
  return formData
}

export function MultiPartForm<TFieldValues extends FieldValues = FieldValues>({
  children,
  form,
  className,
}: {
  children: React.ReactNode
  form: UseFormReturn<TFieldValues>
  className?: string
}) {
  const submit = useSubmit()
  const token = useAuthenticityToken()

  return (
    <FormProvider {...form}>
      <Form
        className={className}
        id='customerForm'
        method='post'
        onSubmit={form.handleSubmit(data => {
          const formData = createFromData(data)
          formData.append('csrf', token)
          submit(formData, {
            method: 'post',
            encType: 'multipart/form-data',
          })
        })}
      >
        {children}
      </Form>
    </FormProvider>
  )
}
