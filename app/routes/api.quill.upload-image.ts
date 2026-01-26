import { type ActionFunctionArgs, data } from 'react-router'
import { v4 as uuidv4 } from 'uuid'
import { uploadStreamToS3 } from '~/utils/s3.server'
import { getEmployeeUser } from '~/utils/session.server'

const TEMPLATE_IMAGES_FOLDER = 'template-images'

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB

export const action = async ({ request }: ActionFunctionArgs) => {
  const user = await getEmployeeUser(request).catch(() => null)
  if (!user) {
    return data({ error: 'Unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return data({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('image')

  if (!(file instanceof File)) {
    return data({ error: 'No image provided' }, { status: 400 })
  }

  if (file.size === 0) {
    return data({ error: 'Empty file provided' }, { status: 400 })
  }

  const extension = ALLOWED_IMAGE_TYPES[file.type]
  if (!extension) {
    return data(
      { error: 'Invalid image type. Allowed: JPEG, PNG, GIF, WebP' },
      { status: 400 },
    )
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return data({ error: 'Image too large. Maximum size is 10MB' }, { status: 400 })
  }

  const filename = `${uuidv4()}.${extension}`

  let arrayBuffer: ArrayBuffer
  try {
    arrayBuffer = await file.arrayBuffer()
  } catch {
    return data({ error: 'Failed to read file' }, { status: 400 })
  }

  const buffer = Buffer.from(arrayBuffer)

  let url: string | undefined
  try {
    url = await uploadStreamToS3(
      (async function* () {
        yield new Uint8Array(buffer)
      })(),
      filename,
      TEMPLATE_IMAGES_FOLDER,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return data({ error: `Upload failed: ${message}` }, { status: 500 })
  }

  if (!url) {
    return data({ error: 'Upload failed: No URL returned' }, { status: 500 })
  }

  return data({ url })
}
