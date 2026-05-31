import { ScanSearch } from 'lucide-react'
import { createPortal } from 'react-dom'
import { cn } from '~/lib/utils'
import { CAROUSEL_LENS_SIZE } from '~/utils/carouselMagnifier'

interface CarouselMagnifierLensProps {
  imageUrl: string
  isMobile: boolean
  zoomMode: boolean
  zoomScale: number
  zoomHint: string
  lens: {
    visible: boolean
    left: number
    top: number
    bgX: number
    bgY: number
    bgWidth: number
    bgHeight: number
  }
  onZoomToggle: () => void
}

export function CarouselMagnifierLensPortal({
  imageUrl,
  isMobile,
  zoomMode,
  lens,
}: Pick<CarouselMagnifierLensProps, 'imageUrl' | 'isMobile' | 'zoomMode' | 'lens'>) {
  if (!zoomMode || !lens.visible || isMobile || typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div
      className='pointer-events-none fixed z-[9999] rounded-full border-4 border-white bg-white shadow-[0_12px_40px_rgba(0,0,0,0.35)] ring-1 ring-black/20'
      style={{
        width: CAROUSEL_LENS_SIZE,
        height: CAROUSEL_LENS_SIZE,
        left: lens.left,
        top: lens.top,
        transform: 'translate(-50%, -50%)',
        backgroundImage: `url(${imageUrl})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${lens.bgWidth}px ${lens.bgHeight}px`,
        backgroundPosition: `${lens.bgX}px ${lens.bgY}px`,
      }}
    >
      <span className='absolute inset-0 rounded-full shadow-[inset_0_0_18px_rgba(255,255,255,0.35)]' />
    </div>,
    document.body,
  )
}

export function CarouselMagnifierControls({
  isMobile,
  zoomMode,
  zoomScale,
  zoomHint,
  onZoomToggle,
}: Omit<CarouselMagnifierLensProps, 'imageUrl' | 'lens'>) {
  return (
    <>
      {!isMobile ? (
        <button
          type='button'
          onClick={onZoomToggle}
          className={cn(
            'absolute left-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-full border transition-all duration-200 ease-out',
            'backdrop-blur-md shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2',
            zoomMode
              ? zoomScale === 2
                ? 'border-blue-800/95 bg-gradient-to-br from-blue-800 via-blue-900 to-blue-950 text-white shadow-blue-950/45 ring-2 ring-blue-500/45 hover:from-blue-900 hover:via-blue-950 hover:to-blue-950'
                : 'border-sky-300/90 bg-gradient-to-br from-sky-500 to-sky-700 text-white shadow-sky-900/30 ring-2 ring-sky-200/50 hover:from-sky-500 hover:to-sky-800'
              : 'border-white/60 bg-gradient-to-br from-white/90 to-zinc-100/95 text-zinc-800 shadow-black/10 hover:border-sky-200/90 hover:from-white hover:to-sky-50/90 hover:text-sky-950 hover:shadow-xl',
          )}
          aria-label={zoomMode ? `Magnifier ${zoomScale}x active` : 'Enable zoom mode'}
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
    </>
  )
}
