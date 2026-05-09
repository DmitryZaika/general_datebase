import { ScanSearch } from 'lucide-react'
import { type ComponentProps, useEffect, useRef, useState } from 'react'
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '~/components/ui/carousel'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '~/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'
import { useIsMobile } from '~/hooks/use-mobile'
import { useArrowCarousel } from '~/hooks/useArrowToggle'
import { cn } from '~/lib/utils'
import { capitalizeFirstLetter } from '~/utils/words'

interface ImageInput {
  id: number
  url: string | null
  name: string
  type: string
  available: number | null
  amount?: number | null
  whole_available?: number | null
  whole_amount?: number | null
  regular_stock?: boolean | number
  width?: number | null
  length?: number | null
  retail_price?: number | null
  cost_per_sqft?: number
  level?: number | null
  finishing?: string | null
}

interface ImageProps {
  name?: string
  src: string | null
  alt?: string
  className?: string
  isOpen: boolean
  id: number
  type: string
  setImage: (value: undefined | number) => void
  image?: ImageInput
  showInfo?: boolean
  userRole?: string
}

function ChildrenImagesDialog({
  src,
  name,
  alt,
  isOpen,
  id,
  type,
  image,
  showInfo = false,
  userRole,
}: ImageProps) {
  const isMobile = useIsMobile()
  const [data, setData] = useState<
    { images: { id: number; url: string }[] } | undefined
  >()
  const [selectedImage, setSelectedImage] = useState<string | null>(src)
  const [pinnedInstalledUrl, setPinnedInstalledUrl] = useState<string | null>(null)
  const [zoomMode, setZoomMode] = useState(false)
  const [zoomScale, setZoomScale] = useState(1.5)
  const [zoomHint, setZoomHint] = useState('')
  const [lastZoomClickAt, setLastZoomClickAt] = useState<number | null>(null)
  const [lens, setLens] = useState({
    visible: false,
    left: 0,
    top: 0,
    bgX: 0,
    bgY: 0,
    bgWidth: 0,
    bgHeight: 0,
  })
  const lensSize = 700
  const zoomHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (zoomHintTimerRef.current) clearTimeout(zoomHintTimerRef.current)
    }
  }, [])

  const showZoomHint = (message: string) => {
    setZoomHint(message)
    if (zoomHintTimerRef.current) clearTimeout(zoomHintTimerRef.current)
    zoomHintTimerRef.current = setTimeout(() => {
      setZoomHint('')
      zoomHintTimerRef.current = null
    }, 3000)
  }

  useEffect(() => {
    if (isOpen) {
      getImages()
      setSelectedImage(src)
      setPinnedInstalledUrl(null)
      setZoomMode(false)
      setZoomScale(1.5)
      setLastZoomClickAt(null)
      setZoomHint('')
      if (zoomHintTimerRef.current) {
        clearTimeout(zoomHintTimerRef.current)
        zoomHintTimerRef.current = null
      }
      setLens(prev => ({ ...prev, visible: false }))
    }
  }, [isOpen, src, id, type])

  useEffect(() => {
    if (!isMobile) return
    setZoomMode(false)
    setZoomScale(1.5)
    setLastZoomClickAt(null)
    setZoomHint('')
    if (zoomHintTimerRef.current) {
      clearTimeout(zoomHintTimerRef.current)
      zoomHintTimerRef.current = null
    }
    setLens(current => ({ ...current, visible: false }))
  }, [isMobile])

  const getImages = () => {
    fetch(`/api/installed_${type}/${id}`)
      .then(async res => {
        if (!res.ok) return { images: [] }
        return res.json()
      })
      .then(body => {
        const list =
          body && typeof body === 'object' && 'images' in body ? body.images : []
        setData({ images: Array.isArray(list) ? list : [] })
      })
      .catch(() => {
        setData({ images: [] })
      })
  }

  const handleMouseEnter = (imageUrl: string) => {
    setSelectedImage(imageUrl)
  }

  const handleMouseLeaveContainer = () => {
    setSelectedImage(pinnedInstalledUrl ?? src)
  }

  const handleMainImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    e.stopPropagation()
    if (zoomMode) {
      setZoomMode(false)
      setZoomScale(1.5)
      setLastZoomClickAt(null)
      setLens(current => ({ ...current, visible: false }))
      showZoomHint('Magnifier off')
      return
    }
    const showingInstalled =
      pinnedInstalledUrl !== null || (selectedImage ?? '') !== (src ?? '')
    if (!showingInstalled) return
    setPinnedInstalledUrl(null)
    setSelectedImage(src)
  }

  const handleZoomToggle = () => {
    const now = Date.now()
    if (!zoomMode) {
      setZoomMode(true)
      setZoomScale(1.5)
      setLastZoomClickAt(now)
      showZoomHint('Magnifier: 1.5x. Click again within 3s for 2x')
      return
    }

    if (zoomScale === 1.5) {
      const withinThreeSeconds =
        lastZoomClickAt !== null && now - lastZoomClickAt <= 3000
      if (withinThreeSeconds) {
        setZoomScale(2)
        setLastZoomClickAt(now)
        showZoomHint('Magnifier: 2x. Click again to turn off')
      } else {
        setZoomMode(false)
        setZoomScale(1.5)
        setLastZoomClickAt(null)
        setLens(current => ({ ...current, visible: false }))
        showZoomHint('Magnifier off')
      }
      return
    }

    setZoomMode(false)
    setZoomScale(1.5)
    setLastZoomClickAt(null)
    setLens(current => ({ ...current, visible: false }))
    showZoomHint('Magnifier off')
  }

  const handleZoomMove = (e: React.MouseEvent<HTMLImageElement>) => {
    if (isMobile || !zoomMode || !selectedImage) return
    const rect = e.currentTarget.getBoundingClientRect()
    const naturalWidth = e.currentTarget.naturalWidth
    const naturalHeight = e.currentTarget.naturalHeight
    if (!naturalWidth || !naturalHeight) return
    const imageScale = Math.min(rect.width / naturalWidth, rect.height / naturalHeight)
    const imageWidth = naturalWidth * imageScale
    const imageHeight = naturalHeight * imageScale
    const imageLeft = (rect.width - imageWidth) / 2
    const imageTop = (rect.height - imageHeight) / 2
    const pointerX = e.clientX - rect.left
    const pointerY = e.clientY - rect.top
    const inImageBounds =
      pointerX >= imageLeft &&
      pointerX <= imageLeft + imageWidth &&
      pointerY >= imageTop &&
      pointerY <= imageTop + imageHeight
    if (!inImageBounds) {
      setLens(current => ({ ...current, visible: false }))
      return
    }
    const imageX = pointerX - imageLeft
    const imageY = pointerY - imageTop

    setLens({
      visible: true,
      left: pointerX,
      top: pointerY,
      bgX: lensSize / 2 - imageX * zoomScale,
      bgY: lensSize / 2 - imageY * zoomScale,
      bgWidth: imageWidth * zoomScale,
      bgHeight: imageHeight * zoomScale,
    })
  }

  const isRegularStock = !!image?.regular_stock
  const wholeAvail = image?.whole_available ?? image?.available ?? 0
  const wholeAmt = image?.whole_amount ?? image?.amount ?? 0
  const totalAvail = image?.available ?? 0
  const displayedAvailable =
    isRegularStock && wholeAvail === 0
      ? 'Regular Stock'
      : wholeAvail > 0
        ? `${wholeAvail} / ${wholeAmt > 0 ? wholeAmt : '—'}${isRegularStock ? ' (Regular stock)' : ''}`
        : totalAvail > 0
          ? 'Remnants Only'
          : image?.available !== undefined
            ? `${image.available}`
            : '—'
  const displayedType = image?.type ? capitalizeFirstLetter(image.type) : '—'
  const displayedWidth = image?.width && image?.width > 0 ? image.width : '—'
  const displayedLength = image?.length && image?.length > 0 ? image.length : '—'
  const displayedPrice =
    image?.retail_price && image.retail_price !== 0
      ? `$${image.retail_price}`
      : image?.cost_per_sqft
        ? `By slab $${image.cost_per_sqft} sqft`
        : '—'
  const displayedLevel = image?.level != null ? String(image.level) : '—'
  const displayedFinishing =
    image?.finishing != null && String(image.finishing).trim() !== ''
      ? capitalizeFirstLetter(String(image.finishing))
      : '—'
  const isStoneCarousel = type === 'stones'
  const isCustomerStone = isStoneCarousel && userRole === 'customer'
  const isEmployeeStone = isStoneCarousel && userRole === 'employee'
  const isCustomerSinkOrFaucet =
    userRole === 'customer' && (type === 'sinks' || type === 'faucets')

  const mainImageShowsInstalled =
    pinnedInstalledUrl !== null || (selectedImage ?? '') !== (src ?? '')

  const infoPairs: { key: string; label: string; value: string }[] = [
    { key: 'type', label: 'Type', value: displayedType },
    { key: 'size', label: 'Size', value: `${displayedLength} x ${displayedWidth}` },
    { key: 'available', label: 'Available', value: displayedAvailable },
  ]
  if (isStoneCarousel) {
    if (isCustomerStone) {
      infoPairs.push({ key: 'level', label: 'Level', value: displayedLevel })
    } else {
      infoPairs.push({ key: 'price', label: 'Price', value: displayedPrice })
      if (isEmployeeStone) {
        infoPairs.push({ key: 'level', label: 'Level', value: displayedLevel })
        infoPairs.push({
          key: 'finishing',
          label: 'Finishing',
          value: displayedFinishing,
        })
      }
    }
  } else if (!isCustomerSinkOrFaucet) {
    infoPairs.push({ key: 'price', label: 'Price', value: displayedPrice })
  }

  const mainPreviewClassName = cn(
    'h-full w-full object-contain z-0 select-none',
    zoomMode
      ? 'cursor-none'
      : mainImageShowsInstalled
        ? 'cursor-pointer'
        : 'cursor-default',
  )

  const mainPreviewHandlers: Pick<
    ComponentProps<'img'>,
    'onMouseEnter' | 'onMouseMove' | 'onMouseLeave' | 'onClick'
  > = {
    onMouseEnter: e => {
      if (zoomMode) handleZoomMove(e)
    },
    onMouseMove: handleZoomMove,
    onMouseLeave: () => {
      if (!zoomMode) return
      setLens(current => ({ ...current, visible: false }))
    },
    onClick: handleMainImageClick,
  }

  return (
    <>
      <div className='w-full flex flex-col justify-center items-center relative select-none'>
        {!isMobile ? (
          <button
            type='button'
            onClick={handleZoomToggle}
            className={cn(
              'absolute left-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-full border transition-all duration-200 ease-out',
              'backdrop-blur-md shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2',
              zoomMode
                ? zoomScale === 2
                  ? 'border-blue-800/95 bg-gradient-to-br from-blue-800 via-blue-900 to-blue-950 text-white shadow-blue-950/45 ring-2 ring-blue-500/45 hover:from-blue-900 hover:via-blue-950 hover:to-blue-950'
                  : 'border-sky-300/90 bg-gradient-to-br from-sky-500 to-sky-700 text-white shadow-sky-900/30 ring-2 ring-sky-200/50 hover:from-sky-500 hover:to-sky-800'
                : 'border-white/60 bg-gradient-to-br from-white/90 to-zinc-100/95 text-zinc-800 shadow-black/10 hover:border-sky-200/90 hover:from-white hover:to-sky-50/90 hover:text-sky-950 hover:shadow-xl',
            )}
            aria-label={
              zoomMode ? `Magnifier ${zoomScale}x active` : 'Enable zoom mode'
            }
            title={zoomMode ? `Magnifier ${zoomScale}x` : 'Enable zoom mode'}
          >
            <ScanSearch
              className='h-[1.35rem] w-[1.35rem] shrink-0'
              strokeWidth={zoomScale === 2 ? 2.5 : zoomMode ? 2.35 : 2.1}
              aria-hidden
            />
          </button>
        ) : null}
        {!isMobile && zoomHint ? (
          <div className='absolute left-14 top-3 z-20 rounded-md border border-zinc-300 bg-white/95 px-2 py-1 text-xs font-medium text-zinc-700 shadow-sm'>
            {zoomHint}
          </div>
        ) : null}
        {showInfo && type !== 'images' && !zoomMode && (
          <div className='absolute top-7 left-1/2 z-10 w-max max-w-[min(90vw,28rem)] -translate-x-1/2 bg-black/80 p-3 rounded shadow-lg text-white border border-gray-900 transition-opacity duration-200 hover:opacity-0'>
            <h3 className='text-lg font-bold mb-3 text-center'>
              {image?.name || name}
            </h3>
            <div className='grid grid-cols-2 gap-x-8 gap-y-2 text-sm justify-items-start'>
              {infoPairs.map(({ key, label, value }) => (
                <p key={key}>
                  <strong>{label}:</strong> {value}
                </p>
              ))}
            </div>
          </div>
        )}
        {selectedImage ? (
          <div className='relative w-full h-[85vh] md:h-[87vh] 2xl:h-[93vh] overflow-hidden'>
            {mainImageShowsInstalled && !zoomMode ? (
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <img
                    src={selectedImage}
                    alt={alt || name || 'Image'}
                    className={mainPreviewClassName}
                    {...mainPreviewHandlers}
                  />
                </TooltipTrigger>
                <TooltipContent
                  side='bottom'
                  sideOffset={10}
                  className='max-w-[15rem] border-zinc-600/90 bg-zinc-900 px-3 py-2 text-center text-[11px] font-medium leading-snug text-zinc-50 shadow-lg'
                >
                  Click the photo to show the main slab again
                </TooltipContent>
              </Tooltip>
            ) : (
              <img
                src={selectedImage}
                alt={alt || name || 'Image'}
                className={mainPreviewClassName}
                {...mainPreviewHandlers}
              />
            )}
            {zoomMode && lens.visible && !isMobile ? (
              <div
                className='pointer-events-none absolute z-20 rounded-full border-4 border-white bg-white shadow-[0_12px_40px_rgba(0,0,0,0.35)] ring-1 ring-black/20'
                style={{
                  width: lensSize,
                  height: lensSize,
                  left: lens.left,
                  top: lens.top,
                  transform: 'translate(-50%, -50%)',
                  backgroundImage: `url(${selectedImage})`,
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: `${lens.bgWidth}px ${lens.bgHeight}px`,
                  backgroundPosition: `${lens.bgX}px ${lens.bgY}px`,
                }}
              >
                <span className='absolute inset-0 rounded-full shadow-[inset_0_0_18px_rgba(255,255,255,0.35)]' />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {data?.images && data.images.length > 0 && (
        <div className='w-screen max-w-full '>
          <Carousel
            className=' flex justify-center items-center w-full  pl-10 pr-10 select-none'
            opts={{
              slidesToScroll: 5,
              align: 'start',
            }}
          >
            <CarouselContent onMouseLeave={handleMouseLeaveContainer}>
              {data.images.map(image => (
                <CarouselItem
                  key={image.id}
                  className='basis-auto max-w-fit pl-2 select-none'
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <img
                        src={image.url}
                        className='w-10 h-10 cursor-pointer'
                        alt={name || 'Image'}
                        onClick={() => {
                          setPinnedInstalledUrl(image.url)
                          setSelectedImage(image.url)
                        }}
                        onMouseEnter={() => handleMouseEnter(image.url)}
                        onAuxClick={e => {
                          if (e.button === 1) {
                            e.preventDefault()
                            window.open(image.url, '_blank')
                          }
                        }}
                      />
                    </TooltipTrigger>
                    <TooltipContent side='top' sideOffset={6}>
                      Lock in this picture
                    </TooltipContent>
                  </Tooltip>
                </CarouselItem>
              ))}
            </CarouselContent>
            {data?.images && data.images.length >= 7 && (
              <>
                <CarouselPrevious className='h-8 w-8 left-0 top-5' />
                <CarouselNext className='h-8 w-8 right-0 top-5' />
              </>
            )}
          </Carousel>
        </div>
      )}
    </>
  )
}

export function SuperCarousel({
  currentId,
  setCurrentId,
  images,
  type,
  userRole,
  showInfo = true,
}: {
  images: ImageInput[]
  currentId?: number
  setCurrentId?: (value: number | undefined) => void
  type: string
  userRole?: string
  showInfo?: boolean
}) {
  const [api, setApi] = useState<CarouselApi>()
  const _ = useArrowCarousel(api)

  useEffect(() => {
    if (!api) return
    if (currentId !== undefined) {
      const index = images.findIndex(({ id }) => id === currentId)
      if (index !== -1) {
        api.scrollTo(index, true)
      }
    }
    api.on('settle', () => {
      const slidesInView = api.slidesInView()
      if (slidesInView.length > 0) {
        setCurrentId?.(images[slidesInView[0]].id)
      }
    })
  }, [api, currentId, images, setCurrentId])

  return (
    <Dialog
      open={currentId !== undefined}
      onOpenChange={open => !open && setCurrentId?.(undefined)}
    >
      <DialogContent
        closeClassName='z-50 top-40 sm:top-10 md:top-25 lg:top-10 right-0 sm:-right-15 md:-right-25 lg:-right-35'
        className='flex flex-col justify-center items-center gap-3 bg-transparent'
      >
        <DialogTitle className='sr-only'>Image Gallery</DialogTitle>
        <DialogDescription className='sr-only'>Image Gallery</DialogDescription>
        <Carousel
          className='max-w-screen max-h-screen w-screen h-screen lg:max-w-[90vw] 2xl:max-w-[60vw]'
          setApi={setApi}
          opts={{
            dragFree: false,
          }}
        >
          <CarouselContent>
            {images.map(image => (
              <CarouselItem key={image.id}>
                <ChildrenImagesDialog
                  type={type}
                  src={image.url}
                  id={image.id}
                  name={image.name}
                  isOpen={currentId === image.id}
                  setImage={value => setCurrentId?.(value)}
                  image={image}
                  showInfo={showInfo}
                  userRole={userRole}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </DialogContent>
    </Dialog>
  )
}
