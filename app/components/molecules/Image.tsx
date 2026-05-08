import { Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContentImage, DialogTrigger } from '~/components/ui/dialog'

interface ImageProps {
  name?: string
  src: string | null
  alt?: string
  className?: string
  isOpen: boolean
  id: number
  setImage: (value: undefined | number) => void
}

export function Image({
  className = '',
  src,
  name,
  alt,
  isOpen,
  id,
  setImage,
}: ImageProps) {
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
  const lensSize = 800
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

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setZoomMode(false)
      setZoomScale(1.5)
      setLastZoomClickAt(null)
      setZoomHint('')
      if (zoomHintTimerRef.current) {
        clearTimeout(zoomHintTimerRef.current)
        zoomHintTimerRef.current = null
      }
      setLens(current => ({ ...current, visible: false }))
      setImage(undefined)
    }
  }

  const handleClose = () => {
    setZoomMode(false)
    setZoomScale(1.5)
    setLastZoomClickAt(null)
    setZoomHint('')
    if (zoomHintTimerRef.current) {
      clearTimeout(zoomHintTimerRef.current)
      zoomHintTimerRef.current = null
    }
    setLens(current => ({ ...current, visible: false }))
    setImage(undefined)
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
    if (!zoomMode || !src) return
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

  return (
    <div className='flex gap-2 flex-col items-center'>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          {src ? (
            <img
              src={src}
              alt={alt || name || 'Image'}
              className={`object-cover  w-full h-40 border-2  rounded cursor-pointer transition duration-200 ease-in-out transform hover:scale-[105%] hover:shadow-lg select-none hover:border-blue-500 hover:bg-gray-300 ${className}`}
              loading='lazy'
              onClick={() => setImage(id)}
            />
          ) : (
            <div
              className={`object-cover w-full h-40 border-2 rounded cursor-pointer flex items-center justify-center bg-gray-200 ${className}`}
              onClick={() => setImage(id)}
              role='button'
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && setImage(id)}
            />
          )}
        </DialogTrigger>

        <DialogContentImage className='flex justify-center items-center'>
          <button
            onClick={handleClose}
            className='absolute top-4 cursor-pointer right-4 z-30 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75 transition'
            aria-label='Закрыть'
          >
            <X className='w-6 h-6' />
          </button>

          {src ? (
            <div className='relative inline-flex max-h-[90vh] max-w-[90vw]'>
              <button
                type='button'
                onClick={handleZoomToggle}
                className='absolute left-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 bg-white/90 text-zinc-700 shadow-sm transition-colors hover:bg-white hover:text-zinc-900'
                aria-label={
                  zoomMode ? `Magnifier ${zoomScale}x active` : 'Enable zoom mode'
                }
                title={zoomMode ? `Magnifier ${zoomScale}x` : 'Enable zoom mode'}
              >
                <Search className='h-4 w-4' />
              </button>
              {zoomHint ? (
                <div className='absolute left-14 top-3 z-20 rounded-md border border-zinc-300 bg-white/95 px-2 py-1 text-xs font-medium text-zinc-700 shadow-sm'>
                  {zoomHint}
                </div>
              ) : null}
              <img
                src={src}
                alt={alt || name || 'Image'}
                className={`h-[90vh] w-auto max-h-[90vh] max-w-[90vw] object-contain ${zoomMode && lens.visible ? 'cursor-none' : 'cursor-default'}`}
                onMouseEnter={e => {
                  if (zoomMode) handleZoomMove(e)
                }}
                onMouseMove={handleZoomMove}
                onMouseLeave={() => {
                  setLens(current => ({ ...current, visible: false }))
                }}
                onClick={e => e.stopPropagation()}
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
                    backgroundImage: `url(${src})`,
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
        </DialogContentImage>
      </Dialog>
      {name && <p className='text-center font-bold font-sans'>{name}</p>}
    </div>
  )
}
