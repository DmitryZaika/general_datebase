// admin.images.tsx

import { ChevronLeft, Pencil, Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  type ActionFunctionArgs,
  Link,
  type LoaderFunctionArgs,
  type MetaFunction,
  Outlet,
  redirect,
  useFetcher,
  useLoaderData,
  useLocation,
  useNavigation,
} from 'react-router'
import { useAuthenticityToken } from 'remix-utils/csrf/react'
import { Spinner } from '~/components/atoms/Spinner'
import { Image } from '~/components/molecules/Image'
import { ImageFolderCard } from '~/components/molecules/ImageFolderCard'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { MediaGridContentSkeleton } from '~/components/organisms/MediaGridSkeleton'
import { Button } from '~/components/ui/button'
import { db } from '~/db.server'
import { useArrowToggle } from '~/hooks/useArrowToggle'
import { useImagesFolderNavigation } from '~/hooks/useImagesFolderNavigation'
import { useScrollMainToTopWhenLoading } from '~/hooks/useScrollMainToTopWhenLoading'
import { cn } from '~/lib/utils'
import { csrf } from '~/utils/csrf.server'
import { loadImagesLibrary } from '~/utils/imagesLibrary.server'
import { isEmployeeListFilterLoading } from '~/utils/isEmployeeListFilterLoading'
import { selectMany } from '~/utils/queryHelpers'
import { getAdminUser, type User } from '~/utils/session.server'

const IMAGE_DRAG_TYPE = 'application/x-admin-image-id'

export const meta: MetaFunction = () => {
  return [{ title: 'Admin – Images' }]
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${encodeURIComponent(String(error))}`)
  }

  const user = await getAdminUser(request)
  return loadImagesLibrary(db, user.company_id)
}

export async function action({ request }: ActionFunctionArgs) {
  let user: User
  try {
    user = await getAdminUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  const formData = await request.formData()
  try {
    csrf.validate(formData, request.headers)
  } catch {
    return Response.json({ error: 'Invalid CSRF token' }, { status: 403 })
  }

  const intent = formData.get('intent')
  if (intent !== 'assignFolder') {
    return Response.json({ error: 'Invalid intent' }, { status: 400 })
  }

  const imageId = Number.parseInt(String(formData.get('imageId') ?? ''), 10)
  const folderId = Number.parseInt(String(formData.get('folderId') ?? ''), 10)
  if (!Number.isFinite(imageId) || !Number.isFinite(folderId)) {
    return Response.json({ error: 'Invalid image or folder id' }, { status: 400 })
  }

  const folderRows = await selectMany<{ id: number }>(
    db,
    `SELECT id FROM images_folders WHERE id = ? AND company_id = ? AND deleted_at IS NULL`,
    [folderId, user.company_id],
  )
  if (!folderRows[0]) {
    return Response.json({ error: 'Folder not found' }, { status: 404 })
  }

  await db.execute(`UPDATE images SET folder_id = ? WHERE id = ? AND company_id = ?`, [
    folderId,
    imageId,
    user.company_id,
  ])

  return Response.json({ ok: true })
}

export default function AdminImages() {
  const { folders, rootImages } = useLoaderData<typeof loader>()
  const navigation = useNavigation()
  const location = useLocation()
  const isListLoading = isEmployeeListFilterLoading(navigation, location, ['folder_id'])
  useScrollMainToTopWhenLoading(isListLoading)
  const fetcher = useFetcher()
  const csrfToken = useAuthenticityToken()
  const [isAddingImage, setIsAddingImage] = useState(false)
  const [isAddingFolder, setIsAddingFolder] = useState(false)
  const [draggingImageId, setDraggingImageId] = useState<number | null>(null)
  const [dropTargetFolderId, setDropTargetFolderId] = useState<number | null>(null)
  const { activeFolderId, activeFolder, isFolderOpen, openFolder, closeFolder } =
    useImagesFolderNavigation(folders)

  useEffect(() => {
    if (activeFolderId && !activeFolder) {
      closeFolder()
    }
  }, [activeFolderId, activeFolder, closeFolder])

  useEffect(() => {
    if (navigation.state === 'idle') {
      if (isAddingImage) setIsAddingImage(false)
      if (isAddingFolder) setIsAddingFolder(false)
    }
  }, [navigation.state, isAddingImage, isAddingFolder])

  const visibleImages = isFolderOpen && activeFolder ? activeFolder.images : rootImages
  const carouselIds = visibleImages.map(image => image.id)
  const isEmpty =
    (!isFolderOpen && folders.length === 0 && rootImages.length === 0) ||
    (isFolderOpen && visibleImages.length === 0)
  const canDragImages = !isFolderOpen
  const isMovingToFolder =
    fetcher.state !== 'idle' && fetcher.formData?.get('intent') === 'assignFolder'
  const movingImageId = isMovingToFolder
    ? Number.parseInt(String(fetcher.formData?.get('imageId') ?? ''), 10)
    : null

  const { currentId, setCurrentId } = useArrowToggle((value: number | undefined) =>
    value ? [value] : carouselIds,
  )

  function assignImageToFolder(imageId: number, folderId: number) {
    setDraggingImageId(null)
    setDropTargetFolderId(null)
    fetcher.submit(
      {
        intent: 'assignFolder',
        imageId: String(imageId),
        folderId: String(folderId),
        csrf: csrfToken,
      },
      { method: 'post' },
    )
  }

  function readDraggedImageId(event: React.DragEvent) {
    const typed = event.dataTransfer.getData(IMAGE_DRAG_TYPE)
    if (typed) {
      const parsed = Number.parseInt(typed, 10)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
    const plain = event.dataTransfer.getData('text/plain')
    const parsed = Number.parseInt(plain, 10)
    return Number.isFinite(parsed) ? parsed : null
  }

  return (
    <>
      <div className='mb-6 flex flex-wrap items-center gap-3 px-2'>
        {isFolderOpen && activeFolder ? (
          <Button
            type='button'
            variant='outline'
            onClick={closeFolder}
            className='gap-1'
          >
            <ChevronLeft className='h-4 w-4' />
            All images
          </Button>
        ) : (
          <>
            <Link
              to={`add`}
              relative='path'
              className='inline-block'
              onClick={() => setIsAddingImage(true)}
            >
              <LoadingButton loading={isAddingImage}>
                <Plus className='w-4 h-4 mr-1' />
                Add Image
              </LoadingButton>
            </Link>
            <Link
              to={`addFolder`}
              relative='path'
              className='inline-block'
              onClick={() => setIsAddingFolder(true)}
            >
              <LoadingButton loading={isAddingFolder}>
                <Plus className='w-4 h-4 mr-1' />
                Add Folder
              </LoadingButton>
            </Link>
          </>
        )}
      </div>
      {isFolderOpen && activeFolder && !isListLoading ? (
        <h2 className='mb-4 px-2 text-xl font-semibold'>{activeFolder.name}</h2>
      ) : null}
      {isListLoading ? (
        <div className='px-2'>
          <MediaGridContentSkeleton
            showFolderHeader={isFolderOpen}
            layout='admin'
            cardCount={isFolderOpen ? 12 : 18}
          />
        </div>
      ) : isEmpty ? (
        <p className='px-2 text-muted-foreground'>
          {isFolderOpen
            ? 'This folder has no images yet.'
            : 'No images or folders yet.'}
        </p>
      ) : (
        <div className='grid grid-cols-2 gap-3 px-2 sm:grid-cols-2 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7'>
          {!isFolderOpen
            ? folders.map(folder => (
                <ImageFolderCard
                  key={`folder-${folder.id}`}
                  name={folder.name}
                  onOpen={() => openFolder(folder.id)}
                  isDropTarget={dropTargetFolderId === folder.id}
                  onDragOver={event => {
                    if (!canDragImages || isMovingToFolder) return
                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'move'
                    setDropTargetFolderId(folder.id)
                  }}
                  onDragLeave={event => {
                    if (event.currentTarget.contains(event.relatedTarget as Node)) {
                      return
                    }
                    setDropTargetFolderId(current =>
                      current === folder.id ? null : current,
                    )
                  }}
                  onDrop={event => {
                    if (!canDragImages || isMovingToFolder) return
                    event.preventDefault()
                    setDropTargetFolderId(null)
                    const imageId = readDraggedImageId(event)
                    if (imageId) {
                      assignImageToFolder(imageId, folder.id)
                    }
                  }}
                  adminActions={
                    <>
                      <Link
                        to={`editFolder/${folder.id}`}
                        className='text-white bg-gray-800 bg-opacity-60 rounded-full p-2 hover:bg-opacity-80 transition'
                        title='Edit Folder'
                        aria-label={`Edit ${folder.name}`}
                        onClick={event => event.stopPropagation()}
                      >
                        <Pencil size={16} />
                      </Link>
                      <Link
                        to={`deleteFolder/${folder.id}`}
                        className='text-white bg-gray-800 bg-opacity-60 rounded-full p-2 hover:bg-opacity-80 transition'
                        title='Delete Folder'
                        aria-label={`Delete ${folder.name}`}
                        onClick={event => event.stopPropagation()}
                      >
                        <X size={16} />
                      </Link>
                    </>
                  }
                />
              ))
            : null}
          {visibleImages.map(image => (
            <div
              key={image.id}
              draggable={canDragImages && !isMovingToFolder}
              onDragStart={event => {
                if (!canDragImages) return
                event.dataTransfer.setData(IMAGE_DRAG_TYPE, String(image.id))
                event.dataTransfer.setData('text/plain', String(image.id))
                event.dataTransfer.effectAllowed = 'move'
                setDraggingImageId(image.id)
              }}
              onDragEnd={() => {
                setDraggingImageId(null)
                setDropTargetFolderId(null)
              }}
              className={cn(
                'relative group',
                canDragImages &&
                  !isMovingToFolder &&
                  'cursor-grab active:cursor-grabbing',
                draggingImageId === image.id && 'opacity-50',
                movingImageId === image.id && 'opacity-60',
              )}
            >
              {movingImageId === image.id ? (
                <div className='pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded bg-white/70'>
                  <Spinner size={32} className='text-sky-600' />
                </div>
              ) : null}
              <Image
                id={image.id}
                src={image.url}
                alt={image.name}
                className='w-full h-48 object-cover rounded'
                isOpen={currentId === image.id}
                setImage={setCurrentId}
              />
              <div className='absolute inset-0 flex justify-between items-start p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300'>
                <Link
                  to={`edit/${image.id}`}
                  className='text-white bg-gray-800 bg-opacity-60 rounded-full p-2 hover:bg-opacity-80 transition pointer-events-auto'
                  title='Edit Image'
                  aria-label={`Edit ${image.name}`}
                  onClick={event => event.stopPropagation()}
                >
                  <Pencil size={16} />
                </Link>
                <Link
                  to={`delete/${image.id}`}
                  className='text-white bg-gray-800 bg-opacity-60 rounded-full p-2 hover:bg-opacity-80 transition pointer-events-auto'
                  title='Delete Image'
                  aria-label={`Delete ${image.name}`}
                  onClick={event => event.stopPropagation()}
                >
                  <X size={16} />
                </Link>
              </div>
              <div className='mt-2 text-center'>
                <h3 className='text-lg font-semibold'>{image.name}</h3>
              </div>
            </div>
          ))}
        </div>
      )}
      <Outlet />
    </>
  )
}
