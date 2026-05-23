import { useEffect, useRef, useState } from 'react'
import { useIsMobile } from '~/hooks/use-mobile'

export const CAROUSEL_LENS_SIZE = 700

export function useCarouselMagnifier(imageUrl: string | null) {
  const isMobile = useIsMobile()
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
  const zoomHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (zoomHintTimerRef.current) clearTimeout(zoomHintTimerRef.current)
    }
  }, [])

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

  const showZoomHint = (message: string) => {
    setZoomHint(message)
    if (zoomHintTimerRef.current) clearTimeout(zoomHintTimerRef.current)
    zoomHintTimerRef.current = setTimeout(() => {
      setZoomHint('')
      zoomHintTimerRef.current = null
    }, 3000)
  }

  const resetZoom = () => {
    setZoomMode(false)
    setZoomScale(1.5)
    setLastZoomClickAt(null)
    setZoomHint('')
    if (zoomHintTimerRef.current) {
      clearTimeout(zoomHintTimerRef.current)
      zoomHintTimerRef.current = null
    }
    setLens(current => ({ ...current, visible: false }))
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
    if (isMobile || !zoomMode || !imageUrl) return
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
      left: e.clientX,
      top: e.clientY,
      bgX: CAROUSEL_LENS_SIZE / 2 - imageX * zoomScale,
      bgY: CAROUSEL_LENS_SIZE / 2 - imageY * zoomScale,
      bgWidth: imageWidth * zoomScale,
      bgHeight: imageHeight * zoomScale,
    })
  }

  const handleMainImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    e.stopPropagation()
    if (!zoomMode) return
    setZoomMode(false)
    setZoomScale(1.5)
    setLastZoomClickAt(null)
    setLens(current => ({ ...current, visible: false }))
    showZoomHint('Magnifier off')
  }

  const mainPreviewHandlers = {
    onMouseEnter: (e: React.MouseEvent<HTMLImageElement>) => {
      if (zoomMode) handleZoomMove(e)
    },
    onMouseMove: handleZoomMove,
    onMouseLeave: () => {
      if (!zoomMode) return
      setLens(current => ({ ...current, visible: false }))
    },
    onClick: handleMainImageClick,
  }

  return {
    isMobile,
    zoomMode,
    zoomScale,
    zoomHint,
    lens,
    resetZoom,
    handleZoomToggle,
    mainPreviewHandlers,
  }
}
