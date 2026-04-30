import { zodResolver } from '@hookform/resolvers/zod'
import { type FileUpload, parseFormData } from '@mjackson/form-data-parser'
import { generateFormData, validateFormData } from 'remix-hook-form'
import { z } from 'zod'
import { csrf } from '~/utils/csrf.server'
import { s3UploadHandler } from '~/utils/s3.server'

const fileSchema = z.object({
  file: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
})

export async function parseMutliForm<Shape extends z.ZodRawShape>(
  request: Request,
  schema: z.ZodObject<Shape>,
  folder: string,
) {
  const finalSchema = schema.extend(fileSchema.shape)
  const resolver = zodResolver(finalSchema)

  async function uploadHandler(fileUpload: FileUpload) {
    const response = await s3UploadHandler(fileUpload, folder)
    return response
  }

  const formData = await parseFormData(request, uploadHandler)

  csrf.validate(formData, request.headers)

  const receivedValues = generateFormData(formData)
  return await validateFormData(receivedValues, resolver)
}
