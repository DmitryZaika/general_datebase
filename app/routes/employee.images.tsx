import { motion } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import { useEffect } from 'react'
import {
  type LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useLocation,
  useNavigation,
} from 'react-router'
import ModuleList from '~/components/ModuleList'
import { Image } from '~/components/molecules/Image'
import { ImageFolderCard } from '~/components/molecules/ImageFolderCard'
import { MediaGridContentSkeleton } from '~/components/organisms/MediaGridSkeleton'
import { Button } from '~/components/ui/button'
import { db } from '~/db.server'
import { useArrowToggle } from '~/hooks/useArrowToggle'
import { useImagesFolderNavigation } from '~/hooks/useImagesFolderNavigation'
import { useScrollMainToTopWhenLoading } from '~/hooks/useScrollMainToTopWhenLoading'
import { EMPLOYEE_VIEW_ENTER } from '~/utils/employeeViewEnterMotion'
import { loadImagesLibrary } from '~/utils/imagesLibrary.server'
import { isEmployeeListFilterLoading } from '~/utils/isEmployeeListFilterLoading'
import { getEmployeeUser, type User } from '~/utils/session.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  let user: User
  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }
  return loadImagesLibrary(db, user.company_id)
}

export default function Images() {
  const { folders, rootImages } = useLoaderData<typeof loader>()
  const location = useLocation()
  const navigation = useNavigation()
  const isListLoading = isEmployeeListFilterLoading(navigation, location, ['folder_id'])
  useScrollMainToTopWhenLoading(isListLoading)
  const { activeFolderId, activeFolder, isFolderOpen, openFolder, closeFolder } =
    useImagesFolderNavigation(folders)

  useEffect(() => {
    if (activeFolderId && !activeFolder) {
      closeFolder()
    }
  }, [activeFolderId, activeFolder, closeFolder])

  const visibleImages = isFolderOpen && activeFolder ? activeFolder.images : rootImages
  const ids = visibleImages.map(item => item.id)
  const { currentId, setCurrentId } = useArrowToggle(ids)
  const isEmpty =
    (!isFolderOpen && folders.length === 0 && rootImages.length === 0) ||
    (isFolderOpen && visibleImages.length === 0)

  return (
    <>
      {isFolderOpen && activeFolder && !isListLoading ? (
        <div className='mb-4 flex flex-wrap items-center gap-3 px-2'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={closeFolder}
            className='gap-1'
          >
            <ChevronLeft className='h-4 w-4' />
            All images
          </Button>
          <h2 className='text-lg font-semibold'>{activeFolder.name}</h2>
        </div>
      ) : null}
      {isListLoading ? (
        <div className='px-2'>
          <MediaGridContentSkeleton
            showFolderHeader={isFolderOpen}
            showFolders={!isFolderOpen}
            folderCount={4}
            cardCount={isFolderOpen ? 12 : 14}
          />
        </div>
      ) : (
        <motion.div
          key={location.pathname}
          className='w-full min-h-0'
          {...EMPLOYEE_VIEW_ENTER}
        >
          {isEmpty ? (
            <p className='px-2 text-muted-foreground'>
              {isFolderOpen
                ? 'This folder has no images yet.'
                : 'No images or folders yet.'}
            </p>
          ) : (
            <ModuleList skipItemMountAnimation>
              {!isFolderOpen
                ? folders.map(folder => (
                    <div key={`folder-${folder.id}`} className='module-item'>
                      <ImageFolderCard
                        name={folder.name}
                        onOpen={() => openFolder(folder.id)}
                      />
                    </div>
                  ))
                : null}
              {visibleImages.map(image => (
                <div key={image.id} className='module-item'>
                  <Image
                    id={image.id}
                    src={image.url}
                    alt={image.name}
                    name={image.name}
                    setImage={setCurrentId}
                    isOpen={currentId === image.id}
                    carouselLens
                  />
                </div>
              ))}
            </ModuleList>
          )}
        </motion.div>
      )}
    </>
  )
}
