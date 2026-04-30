import { zodResolver } from '@hookform/resolvers/zod'
import { type FieldValues, type UseFormReturn, useForm } from 'react-hook-form'
import { z } from 'zod'

export const fileSchema = z.object({
  file: z.instanceof(File),
})

export const multiFileSchema = z.object({
  file: z.array(z.instanceof(File)).min(1),
})

export type MultiImageFormValues = z.infer<typeof multiFileSchema>

const optionalFileSchema = z.object({
  file: z.instanceof(File).optional(),
})

export function useCustomForm<TFieldValues extends FieldValues = FieldValues>(
  schema: TFieldValues,
  defaultValues?: object,
): UseFormReturn<z.infer<TFieldValues & typeof fileSchema>> {
  const finalSchema = schema.merge(fileSchema)
  type finalData = z.infer<typeof finalSchema>

  return useForm<finalData>({
    resolver: zodResolver(finalSchema),
    defaultValues,
  })
}

export function useCustomOptionalForm<TFieldValues extends FieldValues = FieldValues>(
  schema: TFieldValues,
  defaultValues?: object,
): UseFormReturn<z.infer<TFieldValues & typeof optionalFileSchema>> {
  const finalSchema = schema.merge(optionalFileSchema)
  type finalData = z.infer<typeof finalSchema>

  return useForm<finalData>({
    resolver: zodResolver(finalSchema),
    defaultValues,
  })
}
