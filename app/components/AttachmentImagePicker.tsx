import { useQuery } from '@tanstack/react-query'
import { Check, ChevronDown, FileText, Image, Images, Search } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from 'react-router'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import { Checkbox } from '~/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Skeleton } from '~/components/ui/skeleton'
import { useToast } from '~/hooks/use-toast'
import { STONE_FINISHES, STONE_TYPES } from '~/utils/constants'
import { withIconSuffix } from '~/utils/files'

type PickerType = 'stones' | 'images' | 'documents'

const STONE_LEVELS = [1, 2, 3, 4, 5, 6, 7]

interface StoneItem {
  id: number
  name: string
  url: string | null
  type?: string | null
  finishing?: string | null
  level?: number | null
  installed_count?: number
}

interface ImageItem {
  id: number
  name: string
  url: string | null
}

interface DocumentItem {
  id: number
  name: string
  url: string | null
}

interface InstalledImage {
  id: number
  url: string
}

async function fetchStones(
  companyId: number,
  name: string,
  filters: { type: string; finishing: string; level: number[] },
) {
  const params = new URLSearchParams()
  if (name.trim()) params.set('name', name.trim())
  if (filters.type) params.set('type', filters.type)
  if (filters.finishing) params.set('finishing', filters.finishing)
  if (filters.level.length > 0) params.set('level', filters.level.join(','))
  const res = await fetch(`/api/stones/list/${companyId}?${params}`, {
    credentials: 'same-origin',
  })
  if (!res.ok) throw new Error('Failed to load stones')
  const data = await res.json()
  return (data.stones ?? []) as StoneItem[]
}

async function fetchImages(companyId: number, name: string) {
  const params = new URLSearchParams()
  if (name.trim()) params.set('name', name.trim())
  const res = await fetch(`/api/images/list/${companyId}?${params}`, {
    credentials: 'same-origin',
  })
  if (!res.ok) throw new Error('Failed to load images')
  const data = await res.json()
  return (data.images ?? []) as ImageItem[]
}

async function fetchDocuments(companyId: number, name: string) {
  const params = new URLSearchParams()
  if (name.trim()) params.set('name', name.trim())
  const res = await fetch(`/api/documents/list/${companyId}?${params}`, {
    credentials: 'same-origin',
  })
  if (!res.ok) throw new Error('Failed to load documents')
  const data = await res.json()
  return (data.documents ?? []) as DocumentItem[]
}

async function fetchInstalledProjects(stoneId: number): Promise<InstalledImage[]> {
  const res = await fetch(`/api/installed_stones/${stoneId}`, {
    credentials: 'same-origin',
  })
  if (!res.ok) throw new Error('Failed to load installed projects')
  const data = await res.json()
  return (data.images ?? []) as InstalledImage[]
}

async function urlToFile(imageUrl: string, fileName: string): Promise<File> {
  let blob: Blob
  try {
    const direct = await fetch(imageUrl, { mode: 'cors', credentials: 'omit' })
    if (direct.ok) {
      blob = await direct.blob()
    } else {
      throw new Error(`${direct.status}`)
    }
  } catch {
    const proxy = await fetch('/api/attachment/fetch-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: imageUrl }),
      credentials: 'same-origin',
    })
    if (!proxy.ok) throw new Error(`Failed to load image: ${proxy.status}`)
    blob = await proxy.blob()
  }
  const ext = (
    fileName.includes('.') ? (fileName.split('.').pop() ?? '') : ''
  ).toLowerCase()
  const docMime: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }
  const mime =
    blob.type ||
    (docMime[ext] ??
      (ext === 'jpg' || ext === 'jpeg'
        ? 'image/jpeg'
        : ext === 'png'
          ? 'image/png'
          : 'application/octet-stream'))
  return new File([blob], fileName.replace(/[^a-zA-Z0-9.-]/g, '_'), { type: mime })
}

interface AttachmentImagePickerProps {
  type: PickerType
  companyId: number
  open: boolean
  onClose: () => void
  onSelect: (files: File[]) => void
  onAddFiles?: (files: File[]) => void
}

export function AttachmentImagePicker({
  type,
  companyId,
  open,
  onClose,
  onSelect,
  onAddFiles,
}: AttachmentImagePickerProps) {
  const [search, setSearch] = useState('')
  const [selectedMainKeys, setSelectedMainKeys] = useState<Set<string>>(new Set())
  const [installedStoneId, setInstalledStoneId] = useState<number | null>(null)
  const [installedStoneName, setInstalledStoneName] = useState('')
  const [selectedInstalledIds, setSelectedInstalledIds] = useState<Set<number>>(
    new Set(),
  )
  const [filterType, setFilterType] = useState('')
  const [filterFinishing, setFilterFinishing] = useState('')
  const [filterLevel, setFilterLevel] = useState<number[]>([])
  const [activeMain, setActiveMain] = useState(false)
  const [activeInstalled, setActiveInstalled] = useState(false)
  const [activeInstalledProjects, setActiveInstalledProjects] = useState(false)
  const [isAddingMain, setIsAddingMain] = useState(false)
  const [isAddingInstalled, setIsAddingInstalled] = useState(false)
  const navigation = useNavigation()
  const { toast } = useToast()

  useEffect(() => {
    if (navigation.state === 'idle') {
      setActiveMain(false)
      setActiveInstalled(false)
      setActiveInstalledProjects(false)
    }
  }, [navigation.state])

  const stoneFilters = {
    type: filterType,
    finishing: filterFinishing,
    level: filterLevel,
  }
  const toggleLevel = useCallback((level: number) => {
    setFilterLevel(prev =>
      prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level],
    )
  }, [])
  const { data: items = [], isLoading } = useQuery({
    queryKey: [
      'attachmentPicker',
      type,
      companyId,
      search,
      type === 'stones' ? stoneFilters : null,
    ],
    queryFn: () =>
      type === 'stones'
        ? fetchStones(companyId, search, stoneFilters)
        : type === 'documents'
          ? fetchDocuments(companyId, search)
          : fetchImages(companyId, search),
    enabled: open && companyId > 0,
    placeholderData: (prev: (StoneItem | ImageItem | DocumentItem)[] | undefined) =>
      prev,
  })

  const { data: installedImages = [], isLoading: installedLoading } = useQuery({
    queryKey: ['installedStones', installedStoneId],
    queryFn: () => fetchInstalledProjects(installedStoneId ?? 0),
    enabled: installedStoneId !== null && installedStoneId > 0,
  })

  const list = items as (StoneItem | ImageItem | DocumentItem)[]
  const title =
    type === 'stones'
      ? 'From Stones'
      : type === 'documents'
        ? 'From Documents'
        : 'From Images'
  const placeholder =
    type === 'stones'
      ? 'Search stones...'
      : type === 'documents'
        ? 'Search documents...'
        : 'Search images...'

  const getDisplayUrl = useCallback(
    (url: string | null) => {
      if (!url) return null
      if (type === 'documents') return null
      return type === 'stones' ? withIconSuffix(url) : url
    },
    [type],
  )

  const getDownloadUrl = useCallback((url: string | null) => url, [])

  const mainItemKey = useCallback(
    (item: StoneItem | ImageItem | DocumentItem) => `${type}-${item.id}`,
    [type],
  )

  const toggleMain = useCallback(
    (item: StoneItem | ImageItem | DocumentItem) => {
      setSelectedMainKeys(prev => {
        const key = mainItemKey(item)
        const next = new Set(prev)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return next
      })
    },
    [mainItemKey],
  )

  const handleAddMainToEmail = useCallback(async () => {
    setActiveMain(true)
    setIsAddingMain(true)
    const addFn = onAddFiles ?? onSelect
    const selectedItems = list.filter(item => selectedMainKeys.has(mainItemKey(item)))
    if (selectedItems.length === 0) {
      toast({
        title:
          type === 'documents'
            ? 'Select at least one document'
            : 'Select at least one image',
        variant: 'destructive',
      })
      setIsAddingMain(false)
      setActiveMain(false)
      return
    }
    try {
      const files: File[] = []
      for (const item of selectedItems) {
        const downloadUrl = getDownloadUrl(item.url)
        if (!downloadUrl) continue
        const ext =
          downloadUrl.split('.').pop()?.split('?')[0] ||
          (type === 'documents' ? 'pdf' : 'png')
        const baseName = item.name.replace(/[^a-zA-Z0-9.-]/g, '_')
        const safeName = baseName.includes('.') ? baseName : `${baseName}.${ext}`
        files.push(await urlToFile(downloadUrl, safeName))
      }
      if (files.length === 0) {
        toast({
          title:
            type === 'documents'
              ? 'No valid documents selected'
              : 'No valid images selected',
          variant: 'destructive',
        })
        return
      }
      addFn(files)
      setSelectedMainKeys(new Set())
      onClose()
    } catch {
      toast({
        title: 'Failed to attach',
        description: 'Could not load images',
        variant: 'destructive',
      })
    } finally {
      setIsAddingMain(false)
      setActiveMain(false)
    }
  }, [
    type,
    list,
    selectedMainKeys,
    mainItemKey,
    getDownloadUrl,
    onAddFiles,
    onSelect,
    onClose,
    toast,
  ])

  const openInstalled = useCallback((stone: StoneItem) => {
    setActiveInstalledProjects(true)
    setInstalledStoneId(stone.id)
    setInstalledStoneName(stone.name)
    setSelectedInstalledIds(new Set())
  }, [])

  const closeInstalled = useCallback(() => {
    setInstalledStoneId(null)
    setInstalledStoneName('')
    setSelectedInstalledIds(new Set())
  }, [])

  const toggleInstalled = useCallback((id: number) => {
    setSelectedInstalledIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleAddInstalledToEmail = useCallback(async () => {
    setActiveInstalled(true)
    setIsAddingInstalled(true)
    const addFn = onAddFiles ?? onSelect
    const selected = installedImages.filter(img => selectedInstalledIds.has(img.id))
    if (selected.length === 0) {
      toast({ title: 'Select at least one image', variant: 'destructive' })
      setIsAddingInstalled(false)
      setActiveInstalled(false)
      return
    }
    try {
      const files: File[] = []
      for (const img of selected) {
        const ext = img.url.split('.').pop()?.split('?')[0] || 'png'
        const name = `${installedStoneName.replace(/[^a-zA-Z0-9.-]/g, '_')}-${img.id}.${ext}`
        files.push(await urlToFile(img.url, name))
      }
      addFn(files)
      closeInstalled()
      if (!onAddFiles) onClose()
    } catch {
      toast({
        title: 'Failed to attach',
        description: 'Could not load images',
        variant: 'destructive',
      })
    } finally {
      setIsAddingInstalled(false)
      setActiveInstalled(false)
    }
  }, [
    installedImages,
    selectedInstalledIds,
    installedStoneName,
    onAddFiles,
    onSelect,
    onClose,
    closeInstalled,
    toast,
  ])

  return (
    <>
      <Dialog open={open} onOpenChange={o => !o && onClose()}>
        <DialogContent className='max-w-2xl h-[90vh] flex flex-col'>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className='flex flex-col gap-2'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
              <Input
                placeholder={placeholder}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className='pl-9'
              />
            </div>
            {type === 'stones' && (
              <div className='flex flex-wrap gap-2'>
                <Select
                  value={filterType || '_all'}
                  onValueChange={v => setFilterType(v === '_all' ? '' : v)}
                >
                  <SelectTrigger className='w-[140px] h-8 text-xs'>
                    <SelectValue placeholder='Type' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='_all' className='text-xs'>
                      All types
                    </SelectItem>
                    {STONE_TYPES.map(t => (
                      <SelectItem key={t} value={t} className='text-xs capitalize'>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={filterFinishing || '_all'}
                  onValueChange={v => setFilterFinishing(v === '_all' ? '' : v)}
                >
                  <SelectTrigger className='w-[140px] h-8 text-xs'>
                    <SelectValue placeholder='Finishing' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='_all' className='text-xs'>
                      All finishes
                    </SelectItem>
                    {STONE_FINISHES.map(f => (
                      <SelectItem key={f} value={f} className='text-xs capitalize'>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Popover>
                  <PopoverTrigger
                    className='flex h-8 w-[140px] items-center justify-between rounded-md border border-zinc-200 bg-transparent px-3 py-2 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-zinc-950 data-[state=open]:ring-1 dark:border-zinc-800 dark:focus:ring-zinc-300'
                    type='button'
                  >
                    <span className='text-zinc-500 dark:text-zinc-400'>
                      {filterLevel.length === 0
                        ? 'Level'
                        : filterLevel.sort((a, b) => a - b).join(', ')}
                    </span>
                    <ChevronDown className='h-4 w-4 opacity-50' />
                  </PopoverTrigger>
                  <PopoverContent className='w-[140px] p-2' align='start'>
                    <div className='flex flex-col gap-0.5'>
                      {STONE_LEVELS.map(level => (
                        <label
                          key={level}
                          className='flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        >
                          <Checkbox
                            checked={filterLevel.includes(level)}
                            onCheckedChange={() => toggleLevel(level)}
                          />
                          <span>Level {level}</span>
                        </label>
                      ))}
                      {filterLevel.length > 0 && (
                        <button
                          type='button'
                          onClick={() => setFilterLevel([])}
                          className='mt-1 rounded-sm px-2 py-1.5 text-left text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300'
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
          <div className='flex-1 min-h-[280px] min-h-0 overflow-y-auto'>
            {isLoading && list.length === 0 ? (
              <div className='grid grid-cols-3 sm:grid-cols-4 gap-3 py-2'>
                {Array.from({ length: 12 }, (_, i) => (
                  <div
                    key={i}
                    className='relative aspect-square rounded-md overflow-hidden border bg-muted'
                  >
                    {type === 'stones' && onAddFiles && (
                      <div className='absolute top-0 left-0 z-10 flex h-6 w-6 items-center justify-center rounded bg-zinc-200 dark:bg-zinc-700'>
                        <Images className='h-4 w-4 text-zinc-400 dark:text-zinc-500' />
                      </div>
                    )}
                    <div className='flex h-full w-full items-center justify-center'>
                      <Image className='h-12 w-12 text-zinc-300 dark:text-zinc-600' />
                    </div>
                    <Skeleton className='absolute bottom-0 left-0 right-0 h-7 rounded-none' />
                  </div>
                ))}
              </div>
            ) : list.length === 0 ? (
              <p className='text-sm text-muted-foreground py-8 text-center'>
                No {type} found.
              </p>
            ) : (
              <div
                className={`grid grid-cols-3 sm:grid-cols-4 gap-3 py-2 ${isLoading ? 'opacity-60 pointer-events-none' : ''}`}
              >
                {list.map(item => {
                  const stoneItem = item as StoneItem
                  const key = mainItemKey(item)
                  const selected = selectedMainKeys.has(key)
                  const showThumb = getDisplayUrl(item.url)
                  return (
                    <div
                      key={item.id}
                      className='relative aspect-square rounded-md overflow-hidden border bg-muted group'
                    >
                      {type === 'stones' &&
                        onAddFiles &&
                        (stoneItem.installed_count ?? 0) > 0 && (
                          <div className='absolute top-0 left-0 z-10'>
                            <LoadingButton
                              type='button'
                              variant='secondary'
                              size='sm'
                              loading={
                                navigation.state !== 'idle' && activeInstalledProjects
                              }
                              className='h-6 text-[10px] px-1.5 bg-black/60 text-white hover:bg-black/80'
                              onClick={e => {
                                e.stopPropagation()
                                openInstalled(stoneItem)
                              }}
                            >
                              <Images className='h-4 w-4' />
                            </LoadingButton>
                          </div>
                        )}
                      {selected && (
                        <div className='absolute top-1.5 right-1.5 z-10 rounded-full bg-blue-500 p-0.5'>
                          <Check className='h-3.5 w-3.5 text-white' strokeWidth={3} />
                        </div>
                      )}
                      <button
                        type='button'
                        className={`absolute inset-0 hover:ring-2 hover:ring-primary focus:outline-none focus:ring-2 focus:ring-primary transition-all ${selected ? 'scale-[0.94] shadow-[inset_0_2px_12px_rgba(0,0,0,0.25)]' : ''}`}
                        onClick={() => toggleMain(item)}
                      >
                        {type === 'documents' ? (
                          <div className='w-full h-full flex flex-col items-center justify-center gap-1 text-muted-foreground'>
                            <FileText className='h-10 w-10' />
                            <span className='text-xs text-center line-clamp-2 px-1'>
                              {item.name}
                            </span>
                          </div>
                        ) : showThumb ? (
                          <img
                            src={showThumb}
                            alt={item.name}
                            className='w-full h-full object-cover'
                          />
                        ) : (
                          <div className='w-full h-full flex items-center justify-center text-xs text-muted-foreground'>
                            No image
                          </div>
                        )}
                        {type !== 'documents' && (
                          <span className='absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs py-1 px-2 truncate'>
                            {item.name}
                          </span>
                        )}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          <div className='flex justify-end pt-2 border-t shrink-0 min-h-[52px]'>
            <LoadingButton
              type='button'
              loading={
                isLoading || (navigation.state !== 'idle' && activeMain) || isAddingMain
              }
              onClick={handleAddMainToEmail}
              disabled={selectedMainKeys.size === 0 || isLoading}
            >
              Add to the email
            </LoadingButton>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={installedStoneId !== null}
        onOpenChange={o => !o && closeInstalled()}
      >
        <DialogContent className='max-w-2xl max-h-[85vh] flex flex-col'>
          <DialogHeader>
            <DialogTitle>Installed Projects – {installedStoneName}</DialogTitle>
          </DialogHeader>
          <div className='flex-1 min-h-[280px] min-h-0 overflow-y-auto'>
            {installedLoading && installedImages.length === 0 ? (
              <div className='grid grid-cols-3 sm:grid-cols-4 gap-3 py-2'>
                {Array.from({ length: 12 }, (_, i) => (
                  <div
                    key={i}
                    className='relative aspect-square rounded-md overflow-hidden border bg-muted'
                  >
                    <div className='flex h-full w-full items-center justify-center'>
                      <Image className='h-12 w-12 text-zinc-300 dark:text-zinc-600' />
                    </div>
                    <Skeleton className='absolute bottom-0 left-0 right-0 h-7 rounded-none' />
                  </div>
                ))}
              </div>
            ) : installedImages.length === 0 ? (
              <p className='text-sm text-muted-foreground py-8 text-center'>
                No installed project images.
              </p>
            ) : (
              <div
                className={`grid grid-cols-3 sm:grid-cols-4 gap-3 py-2 ${installedLoading ? 'opacity-60 pointer-events-none' : ''}`}
              >
                {installedImages.map(img => {
                  const selected = selectedInstalledIds.has(img.id)
                  return (
                    <button
                      key={img.id}
                      type='button'
                      className={`relative aspect-square rounded-md overflow-hidden border bg-muted hover:ring-2 hover:ring-primary focus:outline-none focus:ring-2 focus:ring-primary transition-all ${selected ? 'scale-[0.94] shadow-[inset_0_2px_12px_rgba(0,0,0,0.25)]' : ''}`}
                      onClick={() => toggleInstalled(img.id)}
                    >
                      {selected && (
                        <div className='absolute top-1.5 right-1.5 z-10 rounded-full bg-blue-500 p-0.5'>
                          <Check className='h-3.5 w-3.5 text-white' strokeWidth={3} />
                        </div>
                      )}
                      <img
                        src={img.url}
                        alt=''
                        className='w-full h-full object-cover'
                      />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <div className='flex justify-end pt-2 border-t shrink-0 min-h-[52px]'>
            <LoadingButton
              type='button'
              loading={
                installedLoading ||
                (navigation.state !== 'idle' && activeInstalled) ||
                isAddingInstalled
              }
              onClick={handleAddInstalledToEmail}
              disabled={selectedInstalledIds.size === 0 || installedLoading}
            >
              Add to the email
            </LoadingButton>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
