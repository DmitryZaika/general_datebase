import { Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
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
import { useArrowCarousel } from '~/hooks/useArrowToggle'
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
  const [data, setData] = useState<
    { images: { id: number; url: string }[] } | undefined
  >()
  const [selectedImage, setSelectedImage] = useState<string | null>(src)
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

  const getImages = () => {
    fetch(`/api/installed_${type}/${id}`)
      .then(async res => await res.json())
      .then(setData)
  }

  const handleMouseEnter = (imageUrl: string) => {
    setSelectedImage(imageUrl)
  }

  const handleMouseLeaveContainer = () => {
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
    if (!zoomMode || !selectedImage) return
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

  return (
    <>
      <div className='w-full flex flex-col justify-center items-center relative select-none'>
        <button
          type='button'
          onClick={handleZoomToggle}
          className='absolute left-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 bg-white/90 text-zinc-700 shadow-sm transition-colors hover:bg-white hover:text-zinc-900'
          aria-label={zoomMode ? `Magnifier ${zoomScale}x active` : 'Enable zoom mode'}
          title={zoomMode ? `Magnifier ${zoomScale}x` : 'Enable zoom mode'}
        >
          <Search className='h-4 w-4' />
        </button>
        {zoomHint ? (
          <div className='absolute left-14 top-3 z-20 rounded-md border border-zinc-300 bg-white/95 px-2 py-1 text-xs font-medium text-zinc-700 shadow-sm'>
            {zoomHint}
          </div>
        ) : null}
        {showInfo && (
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
            <img
              src={selectedImage}
              alt={alt || name || 'Image'}
              className={`h-full w-full object-contain z-0 select-none ${zoomMode && lens.visible ? 'cursor-none' : 'cursor-default'}`}
              onMouseEnter={e => {
                if (zoomMode) handleZoomMove(e)
              }}
              onMouseMove={handleZoomMove}
              onMouseLeave={() => {
                if (!zoomMode) return
                setLens(current => ({ ...current, visible: false }))
              }}
              onClick={e => {
                e.stopPropagation()
              }}
            />
            {zoomMode && lens.visible ? (
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
                  <img
                    src={image.url}
                    className='w-10 h-10 cursor-pointer'
                    alt={name || 'Image'}
                    onClick={() => setSelectedImage(image.url)}
                    onMouseEnter={() => handleMouseEnter(image.url)}
                    onAuxClick={e => {
                      if (e.button === 1) {
                        e.preventDefault()
                        window.open(image.url, '_blank')
                      }
                    }}
                  />
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
