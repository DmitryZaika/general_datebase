import { zodResolver } from '@hookform/resolvers/zod'
import { type FileUpload, parseFormData } from '@mjackson/form-data-parser'
import { generateFormData, validateFormData } from 'remix-hook-form'
import { z } from 'zod'
import { csrf } from '~/utils/csrf.server'
import { s3UploadHandler } from '~/utils/s3.server'

const fileSchema = z.object({
  file: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
})

const uploadedFileSchema = z.union([
  z.string().min(1),
  z.array(z.string().min(1)).min(1),
])

const optionalFileSchema = z.object({
  file: uploadedFileSchema.optional(),
})

function omitEmptyUploadFile<T extends Record<string, unknown>>(values: T): T {
  const file = values.file
  if (file === undefined || file === null || file === '') {
    const { file: _removed, ...rest } = values
    return rest as T
  }
  return values
}

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

export async function parseOptionalMultiForm<Shape extends z.ZodRawShape>(
  request: Request,
  schema: z.ZodObject<Shape>,
  folder: string,
) {
  const finalSchema = schema.extend(optionalFileSchema.shape)
  const resolver = zodResolver(finalSchema)

  async function uploadHandler(fileUpload: FileUpload) {
    const response = await s3UploadHandler(fileUpload, folder)
    return response
  }

  const formData = await parseFormData(request, uploadHandler)

  csrf.validate(formData, request.headers)

  const receivedValues = omitEmptyUploadFile(
    generateFormData(formData) as Record<string, unknown>,
  )
  return await validateFormData(receivedValues, resolver)
}
