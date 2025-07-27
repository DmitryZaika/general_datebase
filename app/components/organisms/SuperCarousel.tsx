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
import type { StoneImage } from '~/types'
import { capitalizeFirstLetter } from '~/utils/words'

interface ImageProps {
  name?: string
  src: string | null
  alt?: string
  className?: string
  isOpen: boolean
  id: number
  type: string
  setImage: (value: undefined | number) => void
  image?: StoneImage
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

  const displayedAvailable = image?.available !== undefined ? image.available : '—'
  const displayedType = image?.type ? capitalizeFirstLetter(image.type) : '—'
  const displayedWidth = image?.width && image?.width > 0 ? image.width : '—'
  const displayedLength = image?.length && image?.length > 0 ? image.length : '—'
  const displayedPrice =
    image?.retail_price && image.retail_price !== 0
      ? `$${image.retail_price}`
      : image?.cost_per_sqft
        ? `By slab $${image.cost_per_sqft} sqft`
        : '—'
  return (
    <>
      <div className='w-full relative select-none'>
        {showInfo && (
          <div className='absolute top-7 sm:top-0 left-[50%] -translate-x-1/2 z-10 bg-black/80 p-3  rounded shadow-lg text-white border border-gray-900'>
            <h3 className='text-lg font-bold mb-2 text-center'>
              {image?.name || name}
            </h3>
            <div className='flex flex-col md:flex-row  gap-x-10 text-sm'>
              <div className='flex flex-col  gap-y-1'>
                <p>
                  <strong>Type:</strong> {displayedType}
                </p>
                <p>
                  <strong>Available:</strong> {displayedAvailable}
                </p>
              </div>

              {userRole === 'employee' && (
                <div className='flex flex-col gap-y-1'>
                  <p>
                    <strong>Size:</strong> {displayedLength} x {displayedWidth}
                  </p>
                  <p>
                    <strong>Price:</strong> {displayedPrice}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
        <img
          src={selectedImage || '/path/to/placeholder.png'}
          alt={alt || name || 'Image'}
          className='w-full h-[85vh] md:h-[87vh] 2xl:h-[93vh] object-contain z-0 select-none'
          onClick={e => e.stopPropagation()}
        />
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
}: {
  images: StoneImage[]
  currentId?: number
  setCurrentId?: (value: number | undefined) => void
  type: string
  userRole?: string
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
                  showInfo={true}
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
