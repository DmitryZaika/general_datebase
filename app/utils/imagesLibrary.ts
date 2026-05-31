export interface LibraryImage {
  id: number
  name: string
  url: string | null
  folder_id: number | null
}

export interface LibraryFolder {
  id: number
  name: string
  images: LibraryImage[]
}

export function parseFolderIdParam(value: string | null) {
  if (!value) {
    return null
  }
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }
  return parsed
}
