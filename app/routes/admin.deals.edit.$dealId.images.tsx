import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  type ActionFunctionArgs,
  data,
  Form,
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useNavigation,
} from 'react-router'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'

import { FileInput } from '~/components/molecules/FileInput'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { MultiPartForm } from '~/components/molecules/MultiPartForm'
import { SuperCarousel } from '~/components/organisms/SuperCarousel'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { FormField } from '~/components/ui/form'

import { db } from '~/db.server'
import { commitSession, getSession } from '~/sessions.server'
import { csrf } from '~/utils/csrf.server'
import { parseMutliForm } from '~/utils/parseMultiForm'
import { posthogClient } from '~/utils/posthog.server'
import { selectMany } from '~/utils/queryHelpers'
import { deleteFile } from '~/utils/s3.server'
import { presignIfS3Uri } from '~/utils/s3Presign.server'
import { getEmployeeUser } from '~/utils/session.server'
import { forceRedirectError, toastData } from '~/utils/toastHelpers.server'
import { fileSchema, useCustomForm } from '~/utils/useCustomForm'

interface DealImage {
  id: number
  image_url: string
  created_at: string
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  await csrf.validate(request)

  if (!params.dealId) {
    return forceRedirectError(request.headers, 'No deal ID provided')
  }
  const dealId = parseInt(params.dealId)

  const requestClone = request.clone()
  const contentType = request.headers.get('Content-Type') || ''

  if (request.method === 'DELETE') {
    const form = await requestClone.formData()
    const id = form.get('id')

    if (id) {
      const sid = parseInt(id.toString())

      // Get image URL before deleting
      const result = await selectMany<{ image_url: string }>(
        db,
        'SELECT image_url FROM deals_images WHERE id = ?',
        [sid],
      )

      if (result.length > 0) {
        // Delete from database
        await db.execute(`DELETE FROM deals_images WHERE id = ?`, [sid])

        // Delete from S3
        deleteFile(result[0].image_url)

        const session = await getSession(request.headers.get('Cookie'))
        session.flash('message', toastData('Success', 'Image deleted successfully'))
        return data(
          { success: true },
          {
            headers: { 'Set-Cookie': await commitSession(session) },
          },
        )
      }
    }
    return { error: 'Image not found' }
  } else if (request.method === 'POST') {
    if (contentType.includes('multipart/form-data')) {
      const { errors, data: parsedData } = await parseMutliForm(
        requestClone,
        fileSchema,
        'deals',
      )

      if (errors) {
        return { errors }
      }

      if (!parsedData) {
        return { error: 'No data received' }
      }

      // Insert into database
      try {
        await db.execute(
          `INSERT INTO deals_images (deal_id, image_url) VALUES (?, ?)`,
          [dealId, parsedData.file],
        )

        const session = await getSession(request.headers.get('Cookie'))
        session.flash('message', toastData('Success', 'Image added successfully'))
        return data(
          { success: true },
          {
            headers: { 'Set-Cookie': await commitSession(session) },
          },
        )
      } catch (error) {
        posthogClient.captureException(error)
        return data({ error: 'Failed to save image to database' })
      }
    } else {
      posthogClient.captureException(
        new Error('Invalid content type. Expected multipart/form-data'),
      )
      return data({ error: 'Invalid content type. Expected multipart/form-data' })
    }
  }

  return null
}

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  try {
    await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  if (!params.dealId) {
    return forceRedirectError(request.headers, 'No deal ID provided')
  }

  const dealId = parseInt(params.dealId)

  const images = await selectMany<DealImage>(
    db,
    `SELECT id, image_url, created_at
       FROM deals_images
      WHERE deal_id = ?
        AND NOT (
          LOWER(image_url) LIKE '%.pdf'
          OR LOWER(image_url) LIKE '%.pdf?%'
          OR LOWER(image_url) LIKE '%.doc'
          OR LOWER(image_url) LIKE '%.doc?%'
          OR LOWER(image_url) LIKE '%.docx'
          OR LOWER(image_url) LIKE '%.docx?%'
          OR LOWER(image_url) LIKE '%.xls'
          OR LOWER(image_url) LIKE '%.xls?%'
          OR LOWER(image_url) LIKE '%.xlsx'
          OR LOWER(image_url) LIKE '%.xlsx?%'
          OR LOWER(image_url) LIKE '%.csv'
          OR LOWER(image_url) LIKE '%.csv?%'
          OR LOWER(image_url) LIKE '%.txt'
          OR LOWER(image_url) LIKE '%.txt?%'
        )
      ORDER BY created_at DESC`,
    [dealId],
  )

  const signedImages = await Promise.all(
    images.map(async image => ({
      ...image,
      image_url: await presignIfS3Uri(image.image_url),
    })),
  )

  return { images: signedImages, dealId }
}

function AddImageForm() {
  const navigation = useNavigation()
  const form = useCustomForm(fileSchema)
  const isSubmitting = useNavigation().state !== 'idle'
  const [inputKey, setInputKey] = useState(0)

  useEffect(() => {
    if (navigation.state === 'idle') {
      form.reset()
      setInputKey(k => k + 1)
    }
  }, [navigation.state, form])

  return (
    <MultiPartForm form={form}>
      <div className='flex items-center space-x-4'>
        <FormField
          control={form.control}
          name='file'
          render={({ field }) => (
            <FileInput
              key={inputKey}
              inputName='deals'
              id='deal-image'
              type='image'
              onChange={field.onChange}
            />
          )}
        />
        <LoadingButton type='submit' className='mt-2' loading={isSubmitting}>
          Add image
        </LoadingButton>
      </div>
    </MultiPartForm>
  )
}

export default function DealEditImages() {
  const { images } = useLoaderData<typeof loader>()
  const [currentImageId, setCurrentImageId] = useState<number | undefined>()
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [imageToDelete, setImageToDelete] = useState<number | null>(null)

  // Handle errors

  const handleDeleteClick = (imageId: number) => {
    setImageToDelete(imageId)
    setShowConfirmDialog(true)
  }

  const handleImageClick = (imageId: number) => {
    setCurrentImageId(imageId)
  }

  // Transform images for SuperCarousel
  const carouselImages = images.map(img => ({
    id: img.id,
    url: img.image_url,
    name: `Deal Image ${img.id}`,
    type: 'deals',
    available: null,
    width: undefined,
    length: undefined,
    retail_price: undefined,
    cost_per_sqft: undefined,
  }))

  return (
    <>
      <div className='space-y-4'>
        <AddImageForm />
        <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'>
          {images.map(image => (
            <div key={image.id} className='relative group cursor-pointer'>
              <img
                src={image.image_url}
                alt={`Deal image ${image.id}`}
                className='w-full h-32 object-cover rounded-lg'
                onClick={() => handleImageClick(image.id)}
              />
              <div className='absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300'>
                <Button
                  type='button'
                  onClick={() => handleDeleteClick(image.id)}
                  className='size-6 p-0 text-white bg-red-600 hover:bg-red-700 rounded-full'
                  title='Delete image'
                >
                  <X size={10} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Confirmation Dialog for Delete */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Image</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this image? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Form method='delete' onSubmit={() => setShowConfirmDialog(false)}>
              <AuthenticityTokenInput />
              <input type='hidden' name='id' value={imageToDelete || ''} />
              <Button type='submit' variant='destructive'>
                Delete
              </Button>
            </Form>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SuperCarousel for viewing images */}
      <SuperCarousel
        images={carouselImages}
        currentId={currentImageId}
        setCurrentId={setCurrentImageId}
        type='deals'
        userRole='employee'
        showInfo={false}
      />
    </>
  )
}
