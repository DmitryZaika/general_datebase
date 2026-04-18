import { useEffect, useState } from 'react'
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

  useEffect(() => {
    if (isOpen) {
      getImages()
      setSelectedImage(src)
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
  } else {
    infoPairs.push({ key: 'price', label: 'Price', value: displayedPrice })
  }

  return (
    <>
      <div className='w-full flex flex-col justify-center items-center relative select-none'>
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
          <img
            src={selectedImage}
            alt={alt || name || 'Image'}
            className='w-full h-[85vh] md:h-[87vh] 2xl:h-[93vh] object-contain z-0 select-none'
            onClick={e => e.stopPropagation()}
          />
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
