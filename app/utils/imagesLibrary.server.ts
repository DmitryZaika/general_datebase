import type mysql from 'mysql2/promise'
import type { LibraryFolder, LibraryImage } from '~/utils/imagesLibrary'
import { selectMany } from '~/utils/queryHelpers'

async function loadFolders(db: mysql.Pool, companyId: number) {
  return selectMany<{ id: number; name: string }>(
    db,
    `SELECT id, name FROM images_folders WHERE company_id = ? AND deleted_at IS NULL`,
    [companyId],
  )
}

async function loadImagesWithFolderId(db: mysql.Pool, companyId: number) {
  return selectMany<LibraryImage>(
    db,
    `SELECT id, name, url, folder_id FROM images WHERE company_id = ?`,
    [companyId],
  )
}

async function loadImagesWithoutFolderId(db: mysql.Pool, companyId: number) {
  const rows = await selectMany<{ id: number; name: string; url: string | null }>(
    db,
    `SELECT id, name, url FROM images WHERE company_id = ?`,
    [companyId],
  )
  return rows.map(row => ({
    ...row,
    folder_id: null,
  }))
}

export async function loadImagesLibrary(db: mysql.Pool, companyId: number) {
  const folders = await loadFolders(db, companyId)
  let images = await loadImagesWithFolderId(db, companyId)

  if (images.length === 0) {
    images = await loadImagesWithoutFolderId(db, companyId)
  }

  const imagesByFolder = new Map<number, LibraryImage[]>()
  const rootImages: LibraryImage[] = []

  for (const image of images) {
    if (image.folder_id) {
      const list = imagesByFolder.get(image.folder_id) ?? []
      list.push(image)
      imagesByFolder.set(image.folder_id, list)
    } else {
      rootImages.push(image)
    }
  }

  const sortByName = <T extends { name: string }>(items: T[]) =>
    [...items].sort((a, b) => a.name.localeCompare(b.name))

  const foldersWithImages: LibraryFolder[] = sortByName(folders).map(folder => ({
    ...folder,
    images: sortByName(imagesByFolder.get(folder.id) ?? []),
  }))

  return {
    folders: foldersWithImages,
    rootImages: sortByName(rootImages),
  }
}
