import { useEffect, useState } from 'react'
import { FaLink, FaTimes } from 'react-icons/fa'
import {
  type ActionFunctionArgs,
  data,
  type LoaderFunctionArgs,
  Form as RemixForm,
  redirect,
  useActionData,
  useLoaderData,
  useNavigate,
  useNavigation,
  useParams,
} from 'react-router'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { z } from 'zod'
import { FileInput } from '~/components/molecules/FileInput'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { MultiPartForm } from '~/components/molecules/MultiPartForm'
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
import { Input } from '~/components/ui/input'
import { db } from '~/db.server'
import { commitSession, getSession } from '~/sessions'
import { csrf } from '~/utils/csrf.server'
import { parseMutliForm } from '~/utils/parseMultiForm'
import { selectId, selectMany } from '~/utils/queryHelpers'
import { deleteFile } from '~/utils/s3.server'
import { getAdminUser } from '~/utils/session.server'
import { forceRedirectError, toastData } from '~/utils/toastHelpers'
import { useCustomForm } from '~/utils/useCustomForm'

function LinkedImagesCarousel({ images }: { images: { url: string }[] }) {
  return (
    <div className='overflow-x-auto whitespace-nowrap pb-4'>
      <div className='flex gap-4'>
        {images.map((image, index) => (
          <div key={index} className='w-40 h-32 flex-shrink-0'>
            <img
              src={image.url}
              alt=''
              className='w-full h-full object-cover rounded'
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export const InstalledProjectsSchema = z.object({})
type TInstalledProjectsSchema = z.infer<typeof InstalledProjectsSchema>

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  try {
    await csrf.validate(request)
  } catch {
    return { error: 'Invalid CSRF token' }
  }
  if (!params.stone) {
    return forceRedirectError(request.headers, 'No stone id provided')
  }
  const stoneId = parseInt(params.stone)

  const requestClone = request.clone()
  const contentType = request.headers.get('Content-Type') || ''

  if (request.method === 'DELETE') {
    const form = await requestClone.formData()
    const id = form.get('id')
    const unlinkSourceId = form.get('unlinkSourceId')

    if (unlinkSourceId) {
      try {
        await db.execute(
          `DELETE FROM stone_image_links 
           WHERE stone_id = ? AND source_stone_id = ?`,
          [stoneId, unlinkSourceId],
        )

        const session = await getSession(request.headers.get('Cookie'))
        session.flash('message', toastData('Success', 'Images unlinked successfully'))
        return data(
          { success: true },
          {
            headers: { 'Set-Cookie': await commitSession(session) },
          },
        )
      } catch (error) {
        console.error('Error unlinking images:', error)
        return { error: 'Failed to unlink images' }
      }
    } else if (id) {
      const sid = parseInt(id.toString())
      const result = await selectId<{ url: string | null }>(
        db,
        'SELECT url FROM installed_stones WHERE id = ?',
        sid,
      )
      await db.execute(`DELETE FROM installed_stones WHERE id = ?`, [sid])
      const session = await getSession(request.headers.get('Cookie'))
      if (result?.url) {
        deleteFile(result.url)
      }
      session.flash('message', toastData('Success', 'Image Deleted'))
      return data(
        { success: true },
        {
          headers: { 'Set-Cookie': await commitSession(session) },
        },
      )
    } else {
      return forceRedirectError(request.headers, 'No id provided')
    }
  } else if (request.method === 'POST') {
    if (contentType.includes('multipart/form-data')) {
      const { errors, data: parsedData } = await parseMutliForm(
        requestClone,
        InstalledProjectsSchema,
        'stones',
      )
      if (errors || !parsedData) {
        return { errors }
      }

      try {
        await db.execute(`INSERT INTO installed_stones (url, stone_id) VALUES (?, ?)`, [
          parsedData.file,
          stoneId,
        ])
      } catch (error) {
        console.error('Error connecting to the database:', error)
      }

      const session = await getSession(request.headers.get('Cookie'))
      session.flash('message', toastData('Success', 'Image Added'))
      return data(
        { success: true },
        {
          headers: { 'Set-Cookie': await commitSession(session) },
        },
      )
    } else {
      const formData = await requestClone.formData()
      const intent = formData.get('intent')

      if (intent === 'link_images') {
        const fromStoneId = formData.get('fromStoneId')

        if (!fromStoneId) {
          return { error: 'No stone ID provided to link from' }
        }

        try {
          await db.execute(
            `INSERT INTO stone_image_links (stone_id, source_stone_id) 
             VALUES (?, ?)`,
            [stoneId, fromStoneId],
          )

          const session = await getSession(request.headers.get('Cookie'))
          session.flash('message', toastData('Success', 'Images linked successfully'))
          return data(
            { success: true },
            {
              headers: { 'Set-Cookie': await commitSession(session) },
            },
          )
        } catch (error) {
          console.error('Error linking images:', error)
          return { error: 'Failed to link images' }
        }
      }
    }
  }

  return null
}

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  try {
    await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  if (!params.stone) {
    return forceRedirectError(request.headers, 'No stone id provided')
  }
  const stoneId = parseInt(params.stone)
  const stones = await selectMany<{ id: number; url: string }>(
    db,
    'select id, url from installed_stones WHERE stone_id = ?',
    [stoneId],
  )

  const allStones = await selectMany<{ id: number; name: string }>(
    db,
    `SELECT DISTINCT s.id, s.name 
     FROM stones s
     WHERE s.id != ? 
     AND (
       EXISTS (SELECT 1 FROM installed_stones i WHERE i.stone_id = s.id)
     )
     ORDER BY s.name ASC`,
    [stoneId],
  )

  const linkedImages = await selectMany<{
    id: number
    source_stone_id: number
    source_stone_name: string
    url: string
  }>(
    db,
    `SELECT sil.id, sil.source_stone_id, s.name as source_stone_name, is2.url
     FROM stone_image_links sil
     JOIN stones s ON sil.source_stone_id = s.id
     JOIN installed_stones is2 ON is2.stone_id = sil.source_stone_id
     WHERE sil.stone_id = ?
     ORDER BY s.name ASC`,
    [stoneId],
  ).catch(err => {
    console.error('Error fetching linked images:', err)
    return []
  })

  return { stones, allStones, linkedImages, currentStoneId: stoneId }
}

function AddImage() {
  const navigation = useNavigation()
  const isSubmitting = useNavigation().state === 'submitting'
  const form = useCustomForm<TInstalledProjectsSchema>(InstalledProjectsSchema)

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
              inputName='images'
              id='image'
              type='image'
              onChange={field.onChange}
            />
          )}
        />
        <LoadingButton loading={isSubmitting}>Add Stone</LoadingButton>
      </div>
    </MultiPartForm>
  )
}

interface LinkImagesDialogProps {
  allStones: Array<{ id: number; name: string }>
  isOpen: boolean
  onClose: () => void
  currentStoneId: number
}

function LinkImagesDialog({
  allStones,
  isOpen,
  onClose,
  currentStoneId,
}: LinkImagesDialogProps) {
  const [selectedStoneId, setSelectedStoneId] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'
  const actionData = useActionData()

  useEffect(() => {
    if (!isOpen) {
      setSelectedStoneId('')
      setSearchTerm('')
    }
  }, [isOpen])

  useEffect(() => {
    if (actionData?.success && navigation.state === 'idle') {
      onClose()
    }
  }, [actionData, navigation.state, onClose])

  const filteredStones = allStones.filter(stone =>
    stone.name.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        if (!open) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link Images from Another Stone</DialogTitle>
        </DialogHeader>

        <div className='mb-4'>
          <Input
            placeholder='Search stones...'
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className='mb-2'
          />

          <div className='max-h-60 overflow-y-auto border rounded p-2'>
            {filteredStones.length === 0 ? (
              <p className='text-gray-500 text-center py-2'>No stones found</p>
            ) : (
              filteredStones.map(stone => (
                <div
                  key={stone.id}
                  className={`p-2 cursor-pointer rounded hover:bg-gray-100 ${
                    selectedStoneId === String(stone.id) ? 'bg-gray-100' : ''
                  }`}
                  onClick={() => setSelectedStoneId(String(stone.id))}
                >
                  {stone.name}
                </div>
              ))
            )}
          </div>
        </div>

        <RemixForm
          method='post'
          className='flex justify-end gap-2'
          onSubmit={() => {
            if (selectedStoneId) {
              setTimeout(() => onClose(), 100)
            }
          }}
        >
          <AuthenticityTokenInput />
          <input type='hidden' name='intent' value='link_images' />
          <input type='hidden' name='fromStoneId' value={selectedStoneId} />
          <Button type='button' variant='outline' onClick={onClose}>
            Cancel
          </Button>
          <Button type='submit' disabled={!selectedStoneId || isSubmitting}>
            Link Images
          </Button>
        </RemixForm>
      </DialogContent>
    </Dialog>
  )
}

export default function SelectImages() {
  const { stones, allStones, linkedImages, currentStoneId } =
    useLoaderData<typeof loader>()
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [unlinkSourceId, setUnlinkSourceId] = useState<number | null>(null)
  const [unlinkStoneName, setUnlinkStoneName] = useState<string>('')
  const navigate = useNavigate()
  const params = useParams()
  const navigation = useNavigation()
  const actionData = useActionData()

  useEffect(() => {
    if (actionData?.success && navigation.state === 'idle') {
      navigate(`/admin/stones/edit/${params.stone}/images`, { replace: true })
    }
  }, [actionData, navigation.state, navigate, params.stone])

  const handleUnlinkClick = (sourceId: number, name: string) => {
    setUnlinkSourceId(sourceId)
    setUnlinkStoneName(name)
    setShowConfirmDialog(true)
  }

  const groupedLinkedImages = linkedImages.reduce<
    Record<number, { name: string; images: Array<{ url: string }> }>
  >((acc, img) => {
    if (!acc[img.source_stone_id]) {
      acc[img.source_stone_id] = {
        name: img.source_stone_name,
        images: [],
      }
    }
    acc[img.source_stone_id].images.push({ url: img.url })
    return acc
  }, {})

  return (
    <>
      <div className='flex justify-between items-center mb-4'>
        <h2 className='text-xl font-bold'>Stone Images</h2>
        <Button
          onClick={() => setShowLinkDialog(true)}
          variant='outline'
          className='flex items-center gap-2'
        >
          <FaLink size={14} />
          Link Images from Different Stone
        </Button>
      </div>

      <AddImage />

      <div className='grid grid-cols-2 md:grid-cols-3 gap-4 mt-4'>
        {stones.map(stone => (
          <div key={stone.id} className='relative group'>
            <img src={stone.url} alt='' className='w-full h-32 object-cover' />
            <div className='absolute top-2 right-2 flex justify-between items-start transition-opacity duration-300'>
              <RemixForm method='delete' title='Delete Stone' aria-label='Delete Image'>
                <input type='hidden' name='id' value={stone.id} />
                <AuthenticityTokenInput />
                <Button
                  type='submit'
                  className='size-4 p-4 text-white bg-gray-800 bg-opacity-60 rounded-full transition'
                >
                  <FaTimes />
                </Button>
              </RemixForm>
            </div>
          </div>
        ))}
      </div>

      {Object.keys(groupedLinkedImages).length > 0 && (
        <div className='mt-8 pt-6 border-t border-gray-200 w-full'>
          <h3 className='text-lg font-semibold mb-2'>Linked Images</h3>

          {Object.entries(groupedLinkedImages).map(([sourceId, data]) => (
            <div key={sourceId} className='mb-6 relative'>
              <div className='flex justify-between items-center mb-2'>
                <h4 className='text-md font-medium'>From: {data.name}</h4>
                <Button
                  variant='outline'
                  size='sm'
                  className='text-red-500 border-red-300 hover:bg-red-50 flex items-center gap-1'
                  onClick={() => handleUnlinkClick(parseInt(sourceId), data.name)}
                >
                  <FaTimes size={12} />
                  Unlink
                </Button>
              </div>
              <LinkedImagesCarousel images={data.images} />
            </div>
          ))}
        </div>
      )}

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Unlink</DialogTitle>
            <DialogDescription>
              Are you sure you want to unlink images from {unlinkStoneName}?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant='outline' onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <RemixForm method='delete' onSubmit={() => setShowConfirmDialog(false)}>
              <AuthenticityTokenInput />
              <input type='hidden' name='unlinkSourceId' value={unlinkSourceId || ''} />
              <Button type='submit' variant='destructive'>
                Unlink
              </Button>
            </RemixForm>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LinkImagesDialog
        allStones={allStones}
        isOpen={showLinkDialog}
        onClose={() => setShowLinkDialog(false)}
        currentStoneId={currentStoneId}
      />
    </>
  )
}
