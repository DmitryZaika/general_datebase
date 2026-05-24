import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { type LibraryFolder, parseFolderIdParam } from '~/utils/imagesLibrary'

export function useImagesFolderNavigation(folders: LibraryFolder[]) {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeFolderId = parseFolderIdParam(searchParams.get('folder_id'))

  const activeFolder = useMemo(() => {
    if (!activeFolderId) {
      return null
    }
    return folders.find(folder => folder.id === activeFolderId) ?? null
  }, [activeFolderId, folders])

  const openFolder = useCallback(
    (folderId: number) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev)
          next.set('folder_id', String(folderId))
          return next
        },
        { preventScrollReset: true },
      )
    },
    [setSearchParams],
  )

  const closeFolder = useCallback(() => {
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev)
        next.delete('folder_id')
        return next
      },
      { preventScrollReset: true },
    )
  }, [setSearchParams])

  return {
    activeFolderId,
    activeFolder,
    isFolderOpen: activeFolder !== null,
    openFolder,
    closeFolder,
  }
}
