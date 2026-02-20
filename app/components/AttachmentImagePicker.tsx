import { useQuery } from '@tanstack/react-query'
import { Check, Images, Search } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from 'react-router'
import { LoadingButton } from '~/components/molecules/LoadingButton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { useToast } from '~/hooks/use-toast'
import { withIconSuffix } from '~/utils/files'

type PickerType = 'stones' | 'images'

interface StoneItem {
  id: number
  name: string
  url: string | null
  installed_count?: number
}

interface ImageItem {
  id: number
  name: string
  url: string | null
}

interface InstalledImage {
  id: number
  url: string
}

async function fetchStones(companyId: number, name: string) {
  const params = new URLSearchParams()
  if (name.trim()) params.set('name', name.trim())
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
  const ext = fileName.includes('.') ? (fileName.split('.').pop() ?? 'png') : 'png'
  const mime =
    blob.type || (ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png')
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

  const fetchFn = type === 'stones' ? fetchStones : fetchImages
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['attachmentPicker', type, companyId, search],
    queryFn: () => fetchFn(companyId, search),
    enabled: open && companyId > 0,
  })

  const { data: installedImages = [], isLoading: installedLoading } = useQuery({
    queryKey: ['installedStones', installedStoneId],
    queryFn: () => fetchInstalledProjects(installedStoneId ?? 0),
    enabled: installedStoneId !== null && installedStoneId > 0,
  })

  const list = items as (StoneItem | ImageItem)[]
  const title = type === 'stones' ? 'From Stones' : 'From Images'
  const placeholder = type === 'stones' ? 'Search stones...' : 'Search images...'

  const getDisplayUrl = useCallback(
    (url: string | null) => {
      if (!url) return null
      return type === 'stones' ? withIconSuffix(url) : url
    },
    [type],
  )

  const getDownloadUrl = useCallback((url: string | null) => url, [])

  const mainItemKey = useCallback(
    (item: StoneItem | ImageItem) => `${type}-${item.id}`,
    [type],
  )

  const toggleMain = useCallback(
    (item: StoneItem | ImageItem) => {
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
      toast({ title: 'Select at least one image', variant: 'destructive' })
      setIsAddingMain(false)
      setActiveMain(false)
      return
    }
    try {
      const files: File[] = []
      for (const item of selectedItems) {
        const downloadUrl = getDownloadUrl(item.url)
        if (!downloadUrl) continue
        const ext = downloadUrl.split('.').pop()?.split('?')[0] || 'png'
        const safeName = `${item.name.replace(/[^a-zA-Z0-9.-]/g, '_')}.${ext}`
        files.push(await urlToFile(downloadUrl, safeName))
      }
      if (files.length === 0) {
        toast({ title: 'No valid images selected', variant: 'destructive' })
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
        <DialogContent className='max-w-2xl max-h-[85vh] flex flex-col'>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className='relative'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
            <Input
              placeholder={placeholder}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className='pl-9'
            />
          </div>
          <div className='flex-1 min-h-0 overflow-y-auto'>
            {isLoading ? (
              <div className='grid grid-cols-3 sm:grid-cols-4 gap-3 py-4'>
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div
                    key={i}
                    className='aspect-square rounded-md bg-muted animate-pulse'
                  />
                ))}
              </div>
            ) : list.length === 0 ? (
              <p className='text-sm text-muted-foreground py-8 text-center'>
                No {type} found.
              </p>
            ) : (
              <div className='grid grid-cols-3 sm:grid-cols-4 gap-3 py-2'>
                {list.map(item => {
                  const stoneItem = item as StoneItem
                  const key = mainItemKey(item)
                  const selected = selectedMainKeys.has(key)
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
                        {getDisplayUrl(item.url) ? (
                          <img
                            src={getDisplayUrl(item.url) ?? ''}
                            alt={item.name}
                            className='w-full h-full object-cover'
                          />
                        ) : (
                          <div className='w-full h-full flex items-center justify-center text-xs text-muted-foreground'>
                            No image
                          </div>
                        )}
                        <span className='absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs py-1 px-2 truncate'>
                          {item.name}
                        </span>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          {list.length > 0 && (
            <div className='flex justify-end pt-2 border-t shrink-0'>
              <LoadingButton
                type='button'
                loading={(navigation.state !== 'idle' && activeMain) || isAddingMain}
                onClick={handleAddMainToEmail}
                disabled={selectedMainKeys.size === 0}
              >
                Add to the email
              </LoadingButton>
            </div>
          )}
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
          <div className='flex-1 min-h-0 overflow-y-auto'>
            {installedLoading ? (
              <div className='grid grid-cols-3 sm:grid-cols-4 gap-3 py-4'>
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div
                    key={i}
                    className='aspect-square rounded-md bg-muted animate-pulse'
                  />
                ))}
              </div>
            ) : installedImages.length === 0 ? (
              <p className='text-sm text-muted-foreground py-8 text-center'>
                No installed project images.
              </p>
            ) : (
              <div className='grid grid-cols-3 sm:grid-cols-4 gap-3 py-2'>
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
          {installedImages.length > 0 && (
            <div className='flex justify-end pt-2 border-t shrink-0'>
              <LoadingButton
                type='button'
                loading={
                  (navigation.state !== 'idle' && activeInstalled) || isAddingInstalled
                }
                onClick={handleAddInstalledToEmail}
                disabled={selectedInstalledIds.size === 0}
              >
                Add to the email
              </LoadingButton>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
