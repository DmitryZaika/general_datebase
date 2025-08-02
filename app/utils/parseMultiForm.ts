import { zodResolver } from '@hookform/resolvers/zod'
import { type FileUpload, parseFormData } from '@mjackson/form-data-parser'
import type { FieldErrors, FieldValues } from 'react-hook-form'
import { validateFormData } from 'remix-hook-form'
import { z } from 'zod'
import { csrf } from '~/utils/csrf.server'
import { s3UploadHandler } from '~/utils/s3.server'

const fileSchema = z.object({
  file: z.string(),
})
interface ValidatedData<T extends z.AnyZodObject> {
  data: z.infer<T & typeof fileSchema> | undefined
  errors: FieldErrors<FieldValues> | undefined
}

export async function parseMutliForm<T extends z.AnyZodObject>(
  request: Request,
  schema: T,
  folder: string,
): Promise<ValidatedData<T>> {
  const finalSchema = schema.merge(fileSchema)
  const resolver = zodResolver(finalSchema)

  async function uploadHandler(fileUpload: FileUpload) {
    const response = await s3UploadHandler(fileUpload, folder)
    return response
  }

  const formData = await parseFormData(request, uploadHandler)

  csrf.validate(formData, request.headers)

  const { data, errors } = await validateFormData(formData, resolver)
  return { data: data as z.infer<T & typeof fileSchema>, errors }
}
