import Compressor from 'compressorjs'
import {
  Brush,
  Circle,
  Crop,
  GripHorizontal,
  Minus,
  MoveUpRight,
  Plus,
  Square,
  Trash2,
  Type,
  Undo2,
} from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { cn } from '~/lib/utils'

type Tool = 'brush' | 'line' | 'arrow' | 'rect' | 'ellipse' | 'text' | 'crop'

interface Point {
  x: number
  y: number
}

interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

interface ShapeBase {
  color: string
  size: number
}

type Shape =
  | (ShapeBase & { kind: 'brush'; points: Point[] })
  | (ShapeBase & { kind: 'line'; from: Point; to: Point })
  | (ShapeBase & { kind: 'arrow'; from: Point; to: Point })
  | (ShapeBase & { kind: 'rect'; from: Point; to: Point })
  | (ShapeBase & { kind: 'ellipse'; from: Point; to: Point })
  | (ShapeBase & { kind: 'text'; position: Point; text: string; fontSize: number })

interface AttachmentImageEditorDialogProps {
  file: File | null
  previewUrl?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (file: File) => void
}

const TEXT_FONT_WEIGHT = '600'
const TEXT_FONT_FAMILY = 'Inter, system-ui, sans-serif'
const TEXT_LINE_HEIGHT = 1.15
const TEXT_EDIT_CHROME = 22
const TEXT_TOP_BASELINE_PAD = (TEXT_LINE_HEIGHT - 1) / 2

const TOOLBAR_TOOLS: { tool: Tool; label: string; icon: React.ReactNode }[] = [
  { tool: 'brush', label: 'Brush', icon: <Brush className='h-4 w-4' /> },
  { tool: 'line', label: 'Line', icon: <Minus className='h-4 w-4' /> },
  { tool: 'arrow', label: 'Arrow', icon: <MoveUpRight className='h-4 w-4' /> },
  { tool: 'rect', label: 'Rectangle', icon: <Square className='h-4 w-4' /> },
  { tool: 'ellipse', label: 'Ellipse', icon: <Circle className='h-4 w-4' /> },
  { tool: 'text', label: 'Text', icon: <Type className='h-4 w-4' /> },
  { tool: 'crop', label: 'Crop', icon: <Crop className='h-4 w-4' /> },
]

const DEFAULT_COLORS = [
  '#000000',
  '#ffffff',
  '#ef4444',
  '#fb923c',
  '#fde047',
  '#82c85a',
  '#4cc9e8',
  '#3756e8',
  '#d93bd4',
  '#fb6f9f',
]

function normalizeRect(rect: CropRect): CropRect {
  const x = rect.width < 0 ? rect.x + rect.width : rect.x
  const y = rect.height < 0 ? rect.y + rect.height : rect.y
  return {
    x,
    y,
    width: Math.abs(rect.width),
    height: Math.abs(rect.height),
  }
}

function clampRect(rect: CropRect, width: number, height: number): CropRect {
  const left = Math.max(0, Math.min(rect.x, width - 1))
  const top = Math.max(0, Math.min(rect.y, height - 1))
  const right = Math.max(left + 1, Math.min(rect.x + rect.width, width))
  const bottom = Math.max(top + 1, Math.min(rect.y + rect.height, height))
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  }
}

function getCanvasPoint(
  event: React.PointerEvent<HTMLCanvasElement>,
  canvas: HTMLCanvasElement,
): Point {
  const rect = canvas.getBoundingClientRect()
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height),
  }
}

function drawCropOverlay(canvas: HTMLCanvasElement, cropRect: CropRect | null) {
  const context = canvas.getContext('2d')
  if (!context) return
  context.clearRect(0, 0, canvas.width, canvas.height)
  if (!cropRect) return
  const rect = normalizeRect(cropRect)
  context.fillStyle = 'rgba(0,0,0,0.35)'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.clearRect(rect.x, rect.y, rect.width, rect.height)
  context.strokeStyle = '#ffffff'
  context.lineWidth = 2
  context.setLineDash([8, 6])
  context.strokeRect(rect.x, rect.y, rect.width, rect.height)
  context.setLineDash([])
}

function resizeCanvas(canvas: HTMLCanvasElement, width: number, height: number) {
  if (canvas.width === width && canvas.height === height) return
  canvas.width = width
  canvas.height = height
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  size: number,
) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  if (length < 1) {
    ctx.beginPath()
    ctx.arc(from.x, from.y, Math.max(2, size / 2), 0, Math.PI * 2)
    ctx.fill()
    return
  }
  const angle = Math.atan2(dy, dx)
  const headLength = Math.min(length, Math.max(14, size * 4))
  const headAngle = Math.PI / 6

  const baseX = to.x - Math.cos(angle) * headLength * 0.75
  const baseY = to.y - Math.sin(angle) * headLength * 0.75

  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(baseX, baseY)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(to.x, to.y)
  ctx.lineTo(
    to.x - Math.cos(angle - headAngle) * headLength,
    to.y - Math.sin(angle - headAngle) * headLength,
  )
  ctx.lineTo(
    to.x - Math.cos(angle + headAngle) * headLength,
    to.y - Math.sin(angle + headAngle) * headLength,
  )
  ctx.closePath()
  ctx.fill()
}

function drawShape(ctx: CanvasRenderingContext2D, shape: Shape) {
  ctx.save()
  ctx.strokeStyle = shape.color
  ctx.fillStyle = shape.color
  ctx.lineWidth = shape.size
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  switch (shape.kind) {
    case 'brush': {
      if (shape.points.length === 0) break
      ctx.beginPath()
      const first = shape.points[0]
      ctx.moveTo(first.x, first.y)
      if (shape.points.length === 1) {
        ctx.arc(first.x, first.y, Math.max(1, shape.size / 2), 0, Math.PI * 2)
        ctx.fill()
      } else {
        for (let i = 1; i < shape.points.length; i++) {
          ctx.lineTo(shape.points[i].x, shape.points[i].y)
        }
        ctx.stroke()
      }
      break
    }
    case 'line': {
      ctx.beginPath()
      ctx.moveTo(shape.from.x, shape.from.y)
      ctx.lineTo(shape.to.x, shape.to.y)
      ctx.stroke()
      break
    }
    case 'arrow': {
      drawArrow(ctx, shape.from, shape.to, shape.size)
      break
    }
    case 'rect': {
      ctx.strokeRect(
        shape.from.x,
        shape.from.y,
        shape.to.x - shape.from.x,
        shape.to.y - shape.from.y,
      )
      break
    }
    case 'ellipse': {
      const cx = (shape.from.x + shape.to.x) / 2
      const cy = (shape.from.y + shape.to.y) / 2
      const rx = Math.abs(shape.to.x - shape.from.x) / 2
      const ry = Math.abs(shape.to.y - shape.from.y) / 2
      if (rx < 0.5 || ry < 0.5) break
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      ctx.stroke()
      break
    }
    case 'text': {
      ctx.font = `${TEXT_FONT_WEIGHT} ${shape.fontSize}px ${TEXT_FONT_FAMILY}`
      ctx.textBaseline = 'top'
      const lines = shape.text.split('\n')
      const x0 = shape.position.x
      const y0 = shape.position.y + shape.fontSize * TEXT_TOP_BASELINE_PAD
      let y = y0
      for (const line of lines) {
        ctx.fillText(line, x0, y)
        y += shape.fontSize * TEXT_LINE_HEIGHT
      }
      break
    }
  }
  ctx.restore()
}

function drawAllShapes(
  ctx: CanvasRenderingContext2D,
  shapes: Shape[],
  pending: Shape | null,
) {
  for (const shape of shapes) drawShape(ctx, shape)
  if (pending) drawShape(ctx, pending)
}

function getEditedFileName(name: string): string {
  const base = name.replace(/\.[^/.]+$/, '')
  return `${base || 'image'}-edited.jpg`
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (blob) {
          resolve(blob)
          return
        }
        reject(new Error('Could not save edited image'))
      },
      'image/jpeg',
      0.92,
    )
  })
}

function getCompressionQuality(size: number): number {
  const SEVEN_MB = 7 * 1024 * 1024
  const FIVE_MB = 5 * 1024 * 1024
  const THREE_MB = 3 * 1024 * 1024
  const ONE_MB = 1 * 1024 * 1024
  if (size > SEVEN_MB) return 0.3
  if (size > FIVE_MB) return 0.35
  if (size > THREE_MB) return 0.4
  if (size > ONE_MB) return 0.5
  return 0.7
}

function compressBlob(blob: Blob, fileName: string): Promise<File> {
  const inputFile = new File([blob], fileName, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  })
  return new Promise(resolve => {
    new Compressor(inputFile, {
      quality: getCompressionQuality(inputFile.size),
      mimeType: 'image/jpeg',
      convertSize: Number.POSITIVE_INFINITY,
      success(result) {
        if (result instanceof File) {
          resolve(result)
          return
        }
        resolve(
          new File([result], fileName, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          }),
        )
      },
      error() {
        resolve(inputFile)
      },
    })
  })
}

function getFontSize(brushSize: number): number {
  return Math.max(20, Math.round(brushSize * 6 + 12))
}

export function AttachmentImageEditorDialog({
  file,
  previewUrl,
  open,
  onOpenChange,
  onSave,
}: AttachmentImageEditorDialogProps) {
  const imageRef = useRef<HTMLImageElement | null>(null)
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const cropCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const cropStartRef = useRef<Point | null>(null)
  const textInputRef = useRef<HTMLInputElement | null>(null)
  const textEditRootRef = useRef<HTMLDivElement | null>(null)
  const textDragRef = useRef<{
    pointerId: number
    lastClientX: number
    lastClientY: number
  } | null>(null)
  const pendingTextRef = useRef<{
    position: Point
    value: string
    fontSize: number
  } | null>(null)
  const [tool, setTool] = useState<Tool>('brush')
  const [color, setColor] = useState('#ef4444')
  const [brushSize, setBrushSize] = useState(5)
  const [shapes, setShapes] = useState<Shape[]>([])
  const [pendingShape, setPendingShape] = useState<Shape | null>(null)
  const pendingShapeRef = useRef<Shape | null>(null)
  const [cropRect, setCropRect] = useState<CropRect | null>(null)
  const [pendingText, setPendingText] = useState<{
    position: Point
    value: string
    fontSize: number
  } | null>(null)
  const isPointerDownRef = useRef(false)
  const drawingPointerIdRef = useRef<number | null>(null)
  const globalPointerListenersRef = useRef<{
    up: (e: PointerEvent) => void
    cancel: (e: PointerEvent) => void
  } | null>(null)
  const endDrawOrCropStrokeRef = useRef<
    (pointerId: number, releaseFrom: HTMLElement | null) => void
  >(() => undefined)
  const [isSaving, setIsSaving] = useState(false)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  const editorSessionKeyRef = useRef<string | null>(null)

  useLayoutEffect(() => {
    pendingTextRef.current = pendingText
  }, [pendingText])

  const setLivePendingShape = useCallback((shape: Shape | null) => {
    pendingShapeRef.current = shape
    setPendingShape(shape)
  }, [])

  const setLivePendingText = useCallback(
    (
      text: {
        position: Point
        value: string
        fontSize: number
      } | null,
    ) => {
      pendingTextRef.current = text
      setPendingText(text)
    },
    [],
  )

  const syncCanvasSize = useCallback(() => {
    const image = imageRef.current
    const drawCanvas = drawCanvasRef.current
    const cropCanvas = cropCanvasRef.current
    if (!image || !drawCanvas || !cropCanvas) return
    const rect = image.getBoundingClientRect()
    const width = Math.max(1, Math.round(rect.width))
    const height = Math.max(1, Math.round(rect.height))
    resizeCanvas(drawCanvas, width, height)
    resizeCanvas(cropCanvas, width, height)
    setCanvasSize({ width, height })
  }, [])

  useEffect(() => {
    if (!open) {
      editorSessionKeyRef.current = null
      const listenersClosed = globalPointerListenersRef.current
      if (listenersClosed) {
        window.removeEventListener('pointerup', listenersClosed.up, true)
        window.removeEventListener('pointercancel', listenersClosed.cancel, true)
        globalPointerListenersRef.current = null
      }
      return
    }
    if (!file) return
    const key = `${file.name}-${file.size}-${file.lastModified}`
    if (editorSessionKeyRef.current !== key) {
      editorSessionKeyRef.current = key
      setTool('brush')
      setShapes([])
      setLivePendingShape(null)
      setCropRect(null)
      setLivePendingText(null)
      isPointerDownRef.current = false
      drawingPointerIdRef.current = null
      cropStartRef.current = null
      const listeners = globalPointerListenersRef.current
      if (listeners) {
        window.removeEventListener('pointerup', listeners.up, true)
        window.removeEventListener('pointercancel', listeners.cancel, true)
        globalPointerListenersRef.current = null
      }
    }
  }, [open, file, setLivePendingShape, setLivePendingText])

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(syncCanvasSize)
    window.addEventListener('resize', syncCanvasSize)
    const observer = new ResizeObserver(syncCanvasSize)
    const image = imageRef.current
    if (image) observer.observe(image)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', syncCanvasSize)
      observer.disconnect()
    }
  }, [open, previewUrl, syncCanvasSize])

  useEffect(() => {
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    drawAllShapes(
      ctx,
      shapes.filter(shape => shape.kind !== 'text'),
      pendingShape,
    )
  }, [shapes, pendingShape, canvasSize])

  useEffect(() => {
    const canvas = cropCanvasRef.current
    if (!canvas) return
    drawCropOverlay(canvas, cropRect)
  }, [cropRect, canvasSize])

  useEffect(() => {
    if (pendingText) {
      const id = window.setTimeout(() => textInputRef.current?.focus(), 0)
      return () => window.clearTimeout(id)
    }
  }, [pendingText])

  const handleTextChromePointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    textDragRef.current = {
      pointerId: event.pointerId,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
    }
  }

  const handleTextChromePointerMove = (
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    const drag = textDragRef.current
    if (!drag || event.pointerId !== drag.pointerId) return
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const dx = (event.clientX - drag.lastClientX) * scaleX
    const dy = (event.clientY - drag.lastClientY) * scaleY
    drag.lastClientX = event.clientX
    drag.lastClientY = event.clientY
    const current = pendingTextRef.current
    if (!current) return
    const nx = Math.max(0, Math.min(canvas.width - 1, current.position.x + dx))
    const ny = Math.max(0, Math.min(canvas.height - 1, current.position.y + dy))
    setLivePendingText({ ...current, position: { x: nx, y: ny } })
  }

  const handleTextChromePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = textDragRef.current
    if (drag && event.pointerId === drag.pointerId) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      textDragRef.current = null
    }
  }

  const commitPendingText = (rawValue?: string) => {
    const current = pendingTextRef.current
    if (!current) return
    const resolved =
      rawValue !== undefined
        ? rawValue
        : textInputRef.current
          ? textInputRef.current.value
          : current.value
    const value = resolved.trim()
    setLivePendingText(null)
    if (!value) return
    const textShape: Shape = {
      kind: 'text',
      color,
      size: brushSize,
      position: current.position,
      text: value,
      fontSize: current.fontSize,
    }
    setShapes(prev => [...prev, textShape])
  }

  const handleToolChange = (next: Tool) => {
    if (pendingText) commitPendingText()
    const gListeners = globalPointerListenersRef.current
    if (gListeners) {
      window.removeEventListener('pointerup', gListeners.up, true)
      window.removeEventListener('pointercancel', gListeners.cancel, true)
      globalPointerListenersRef.current = null
    }
    const pid = drawingPointerIdRef.current
    if (pid !== null) {
      const drawCanvas = drawCanvasRef.current
      const cropCanvas = cropCanvasRef.current
      if (drawCanvas?.hasPointerCapture(pid)) {
        drawCanvas.releasePointerCapture(pid)
      }
      if (cropCanvas?.hasPointerCapture(pid)) {
        cropCanvas.releasePointerCapture(pid)
      }
    }
    drawingPointerIdRef.current = null
    isPointerDownRef.current = false
    cropStartRef.current = null
    setTool(next)
    setLivePendingShape(null)
    if (next !== 'crop') setCropRect(null)
  }

  const endDrawOrCropStroke = useCallback(
    (pointerId: number, releaseFrom: HTMLElement | null) => {
      if (drawingPointerIdRef.current !== pointerId) return
      const listeners = globalPointerListenersRef.current
      if (listeners) {
        window.removeEventListener('pointerup', listeners.up, true)
        window.removeEventListener('pointercancel', listeners.cancel, true)
        globalPointerListenersRef.current = null
      }
      drawingPointerIdRef.current = null
      if (releaseFrom?.hasPointerCapture(pointerId)) {
        releaseFrom.releasePointerCapture(pointerId)
      } else {
        const drawCanvas = drawCanvasRef.current
        const cropCanvas = cropCanvasRef.current
        if (drawCanvas?.hasPointerCapture(pointerId)) {
          drawCanvas.releasePointerCapture(pointerId)
        }
        if (cropCanvas?.hasPointerCapture(pointerId)) {
          cropCanvas.releasePointerCapture(pointerId)
        }
      }
      isPointerDownRef.current = false
      cropStartRef.current = null
      if (tool === 'crop') return
      const shapeToCommit = pendingShapeRef.current
      setLivePendingShape(null)
      if (!shapeToCommit) return
      if (shapeToCommit.kind === 'text') return
      if (shapeToCommit.kind !== 'brush') {
        const dx = shapeToCommit.to.x - shapeToCommit.from.x
        const dy = shapeToCommit.to.y - shapeToCommit.from.y
        if (Math.hypot(dx, dy) < 2) return
      }
      if (shapeToCommit) {
        setShapes(prev => [...prev, shapeToCommit])
      }
    },
    [setLivePendingShape, tool],
  )

  useLayoutEffect(() => {
    endDrawOrCropStrokeRef.current = endDrawOrCropStroke
  }, [endDrawOrCropStroke])

  const registerActiveStrokePointerListeners = () => {
    const prev = globalPointerListenersRef.current
    if (prev) {
      window.removeEventListener('pointerup', prev.up, true)
      window.removeEventListener('pointercancel', prev.cancel, true)
      globalPointerListenersRef.current = null
    }
    const up = (e: PointerEvent) => {
      if (e.button !== 0) return
      endDrawOrCropStrokeRef.current(e.pointerId, null)
    }
    const cancel = (e: PointerEvent) => {
      endDrawOrCropStrokeRef.current(e.pointerId, null)
    }
    window.addEventListener('pointerup', up, true)
    window.addEventListener('pointercancel', cancel, true)
    globalPointerListenersRef.current = { up, cancel }
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    if (pendingText) {
      commitPendingText()
      return
    }
    if (drawingPointerIdRef.current !== null) {
      const staleId = drawingPointerIdRef.current
      const drawCanvas = drawCanvasRef.current
      const cropCanvas = cropCanvasRef.current
      const releaseFrom = drawCanvas?.hasPointerCapture(staleId)
        ? drawCanvas
        : cropCanvas?.hasPointerCapture(staleId)
          ? cropCanvas
          : null
      endDrawOrCropStroke(staleId, releaseFrom)
    }
    const canvas = event.currentTarget
    canvas.setPointerCapture(event.pointerId)
    const point = getCanvasPoint(event, canvas)

    if (tool === 'crop') {
      drawingPointerIdRef.current = event.pointerId
      cropStartRef.current = point
      setCropRect({ x: point.x, y: point.y, width: 0, height: 0 })
      isPointerDownRef.current = true
      registerActiveStrokePointerListeners()
      return
    }

    if (tool === 'text') {
      setLivePendingText({
        position: point,
        value: '',
        fontSize: getFontSize(brushSize),
      })
      return
    }

    drawingPointerIdRef.current = event.pointerId
    isPointerDownRef.current = true
    registerActiveStrokePointerListeners()
    if (tool === 'brush') {
      setLivePendingShape({
        kind: 'brush',
        color,
        size: brushSize,
        points: [point],
      })
      return
    }

    setLivePendingShape({
      kind: tool,
      color,
      size: brushSize,
      from: point,
      to: point,
    })
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    if (
      drawingPointerIdRef.current !== null &&
      event.pointerId !== drawingPointerIdRef.current
    ) {
      return
    }
    if (!isPointerDownRef.current) return
    const canvas = event.currentTarget
    const point = getCanvasPoint(event, canvas)

    if (tool === 'crop') {
      const start = cropStartRef.current
      if (!start) return
      setCropRect({
        x: start.x,
        y: start.y,
        width: point.x - start.x,
        height: point.y - start.y,
      })
      return
    }

    const current = pendingShapeRef.current
    if (!current) return
    if (current.kind === 'brush') {
      setLivePendingShape({ ...current, points: [...current.points, point] })
      return
    }
    if (current.kind === 'text') return
    setLivePendingShape({ ...current, to: point })
  }

  const handlePointerUpOrCancel = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    if (event.type === 'pointerup' && event.button !== 0) return
    endDrawOrCropStroke(event.pointerId, event.currentTarget)
  }

  const undo = () => {
    if (pendingText) {
      setLivePendingText(null)
      return
    }
    if (pendingShape) {
      setLivePendingShape(null)
      return
    }
    if (cropRect) {
      setCropRect(null)
      return
    }
    setShapes(prev => prev.slice(0, -1))
  }

  const clearAll = () => {
    const gListeners = globalPointerListenersRef.current
    if (gListeners) {
      window.removeEventListener('pointerup', gListeners.up, true)
      window.removeEventListener('pointercancel', gListeners.cancel, true)
      globalPointerListenersRef.current = null
    }
    setShapes([])
    setLivePendingShape(null)
    setLivePendingText(null)
    setCropRect(null)
    isPointerDownRef.current = false
    drawingPointerIdRef.current = null
  }

  const handleApply = async () => {
    const image = imageRef.current
    const drawCanvas = drawCanvasRef.current
    if (!file || !image || !drawCanvas) return
    const displayWidth = drawCanvas.width
    const displayHeight = drawCanvas.height
    if (
      !displayWidth ||
      !displayHeight ||
      !image.naturalWidth ||
      !image.naturalHeight
    ) {
      return
    }

    let finalShapes = shapes
    const pendingShapeLive = pendingShapeRef.current
    if (pendingShapeLive) finalShapes = [...finalShapes, pendingShapeLive]
    const pendingTextLive = pendingTextRef.current
    if (pendingTextLive) {
      const value = (
        textInputRef.current ? textInputRef.current.value : pendingTextLive.value
      ).trim()
      if (value) {
        finalShapes = [
          ...finalShapes,
          {
            kind: 'text',
            color,
            size: brushSize,
            position: pendingTextLive.position,
            text: value,
            fontSize: pendingTextLive.fontSize,
          },
        ]
      }
      setLivePendingText(null)
    }
    if (finalShapes !== shapes) setShapes(finalShapes)
    setLivePendingShape(null)

    setIsSaving(true)
    try {
      const normalizedCrop = cropRect ? normalizeRect(cropRect) : null
      const usableCrop =
        normalizedCrop && normalizedCrop.width > 8 && normalizedCrop.height > 8
          ? clampRect(normalizedCrop, displayWidth, displayHeight)
          : { x: 0, y: 0, width: displayWidth, height: displayHeight }
      const scaleX = image.naturalWidth / displayWidth
      const scaleY = image.naturalHeight / displayHeight
      const sourceX = Math.max(0, Math.round(usableCrop.x * scaleX))
      const sourceY = Math.max(0, Math.round(usableCrop.y * scaleY))
      const sourceWidth = Math.max(1, Math.round(usableCrop.width * scaleX))
      const sourceHeight = Math.max(1, Math.round(usableCrop.height * scaleY))
      const outputCanvas = document.createElement('canvas')
      outputCanvas.width = sourceWidth
      outputCanvas.height = sourceHeight
      const outputContext = outputCanvas.getContext('2d')
      if (!outputContext) return
      outputContext.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        sourceWidth,
        sourceHeight,
      )
      outputContext.save()
      outputContext.translate(-usableCrop.x * scaleX, -usableCrop.y * scaleY)
      outputContext.scale(scaleX, scaleY)
      drawAllShapes(outputContext, finalShapes, null)
      outputContext.restore()
      const blob = await canvasToBlob(outputCanvas)
      const compressed = await compressBlob(blob, getEditedFileName(file.name))
      onSave(compressed)
      onOpenChange(false)
    } finally {
      setIsSaving(false)
    }
  }

  const isDrawingTool = tool !== 'crop' && tool !== 'text'
  const drawCursor = tool === 'text' ? 'text' : 'default'
  const cropDisabled = !cropRect

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex max-h-[95vh] w-[96vw] max-w-5xl flex-col gap-3 p-4'>
        <DialogHeader>
          <DialogTitle>Edit image</DialogTitle>
        </DialogHeader>

        <div className='flex flex-wrap items-center gap-2 rounded-md border bg-slate-50 p-2'>
          <div className='flex flex-wrap rounded-md border bg-white p-1'>
            {TOOLBAR_TOOLS.map(item => (
              <Button
                key={item.tool}
                type='button'
                size='sm'
                variant={tool === item.tool ? 'default' : 'ghost'}
                onClick={() => handleToolChange(item.tool)}
                className='h-8 w-8 p-0'
                title={item.label}
                aria-label={item.label}
              >
                {item.icon}
              </Button>
            ))}
          </div>

          <div className='flex items-center gap-0.75 rounded-full bg-slate-950 px-2 py-1'>
            {DEFAULT_COLORS.map(swatch => (
              <button
                key={swatch}
                type='button'
                className={cn(
                  'h-4 w-4 px-3 rounded-full border border-white/20 select-none',
                  color.toLowerCase() === swatch
                    ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-950'
                    : '',
                )}
                style={{ backgroundColor: swatch }}
                onClick={() => setColor(swatch)}
                aria-label={`Use color ${swatch}`}
                title={swatch}
              />
            ))}
            <label
              className='flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-white select-none'
              title='Custom color'
            >
              <Plus className='h-5 w-5' />
              <Input
                type='color'
                value={color}
                onChange={event => setColor(event.currentTarget.value)}
                className='sr-only'
                aria-label='Drawing color'
              />
            </label>
          </div>

          <label className='flex items-center gap-2 text-xs font-medium text-slate-600'>
            Size
            <Input
              type='range'
              min='2'
              max='24'
              value={brushSize}
              onChange={event => setBrushSize(Number(event.currentTarget.value))}
              className='h-9 w-28'
            />
            <span className='w-6 tabular-nums text-right'>{brushSize}</span>
          </label>

          <Button
            type='button'
            variant='outline'
            size='sm'
            className='select-none'
            onClick={undo}
            disabled={shapes.length === 0 && !pendingText && !pendingShape && !cropRect}
            title='Undo'
          >
            <Undo2 className='mr-1 h-4 w-4' />
            Undo
          </Button>
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='select-none'
            onClick={clearAll}
            disabled={shapes.length === 0 && !cropRect && !pendingText && !pendingShape}
            title='Clear all'
          >
            <Trash2 className='mr-1 h-4 w-4' />
            Clear
          </Button>
          {tool === 'crop' && (
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => setCropRect(null)}
              disabled={cropDisabled}
            >
              Reset crop
            </Button>
          )}

          <div className='ml-auto flex gap-2'>
            <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type='button' onClick={handleApply} disabled={isSaving || !file}>
              {isSaving ? 'Saving...' : 'Apply'}
            </Button>
          </div>
        </div>

        <div className='min-h-0 flex-1 overflow-auto rounded-md bg-zinc-950 p-2'>
          {previewUrl ? (
            <div className='relative mx-auto w-fit max-w-full overflow-visible leading-none select-none'>
              <img
                ref={imageRef}
                src={previewUrl}
                alt={file?.name || 'Image'}
                className='block max-h-[70vh] max-w-full select-none object-contain'
                draggable={false}
                onLoad={syncCanvasSize}
                onDragStart={event => event.preventDefault()}
              />
              <canvas
                ref={drawCanvasRef}
                className={cn(
                  'absolute inset-0 h-full w-full touch-none',
                  isDrawingTool || tool === 'text' ? '' : 'pointer-events-none',
                )}
                style={{
                  cursor: isDrawingTool || tool === 'text' ? drawCursor : undefined,
                }}
                onPointerDown={
                  isDrawingTool || tool === 'text' ? handlePointerDown : undefined
                }
                onPointerMove={isDrawingTool ? handlePointerMove : undefined}
                onPointerUp={isDrawingTool ? handlePointerUpOrCancel : undefined}
                onPointerCancel={isDrawingTool ? handlePointerUpOrCancel : undefined}
                onDragStart={event => event.preventDefault()}
              />
              <canvas
                ref={cropCanvasRef}
                className={cn(
                  'absolute inset-0 h-full w-full touch-none',
                  tool === 'crop' ? '' : 'pointer-events-none',
                )}
                style={{ cursor: tool === 'crop' ? 'crosshair' : undefined }}
                onPointerDown={tool === 'crop' ? handlePointerDown : undefined}
                onPointerMove={tool === 'crop' ? handlePointerMove : undefined}
                onPointerUp={tool === 'crop' ? handlePointerUpOrCancel : undefined}
                onPointerCancel={tool === 'crop' ? handlePointerUpOrCancel : undefined}
                onDragStart={event => event.preventDefault()}
              />
              {shapes.map((shape, index) => {
                if (shape.kind !== 'text') return null
                return (
                  <input
                    key={`text-${index}`}
                    type='text'
                    value={shape.text}
                    readOnly
                    tabIndex={-1}
                    className='pointer-events-none absolute z-10 m-0 min-w-[7.5rem] max-w-full appearance-none rounded-none border-0 bg-transparent px-0 py-0 leading-none shadow-none outline-none'
                    style={{
                      left: shape.position.x,
                      top: shape.position.y,
                      color: shape.color,
                      font: `${TEXT_FONT_WEIGHT} ${shape.fontSize}px ${TEXT_FONT_FAMILY}`,
                      lineHeight: `${shape.fontSize * TEXT_LINE_HEIGHT}px`,
                      maxWidth: `calc(${canvasSize.width}px - ${shape.position.x}px)`,
                    }}
                    aria-hidden
                  />
                )
              })}
              {pendingText && canvasSize.width > 0 ? (
                <div
                  ref={textEditRootRef}
                  className='absolute z-20 flex flex-col gap-0.5'
                  style={{
                    left: pendingText.position.x,
                    top: pendingText.position.y - TEXT_EDIT_CHROME,
                  }}
                >
                  <button
                    type='button'
                    className='flex h-5 w-full min-w-[7.5rem] cursor-grab touch-none items-center justify-center rounded border border-white/40 bg-black/50 text-white/90 active:cursor-grabbing'
                    aria-label='Move text'
                    onPointerDown={handleTextChromePointerDown}
                    onPointerMove={handleTextChromePointerMove}
                    onPointerUp={handleTextChromePointerUp}
                    onPointerCancel={handleTextChromePointerUp}
                  >
                    <GripHorizontal className='h-3.5 w-3.5' />
                  </button>
                  <input
                    ref={textInputRef}
                    type='text'
                    value={pendingText.value}
                    onChange={event => {
                      const el = event.target
                      if (!(el instanceof HTMLInputElement)) return
                      const next = el.value
                      const current = pendingTextRef.current
                      if (current) setLivePendingText({ ...current, value: next })
                    }}
                    onBlur={event => {
                      const next = event.relatedTarget
                      if (
                        next instanceof Node &&
                        textEditRootRef.current?.contains(next)
                      ) {
                        return
                      }
                      commitPendingText()
                    }}
                    onKeyDown={event => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        const el = event.target
                        commitPendingText(
                          el instanceof HTMLInputElement ? el.value : undefined,
                        )
                      } else if (event.key === 'Escape') {
                        event.preventDefault()
                        setLivePendingText(null)
                      }
                    }}
                    placeholder='Type, Enter to place'
                    className='m-0 min-w-[7.5rem] max-w-full appearance-none rounded-none border-0 bg-black/25 px-0 py-0 leading-none shadow-none'
                    style={{
                      color,
                      outline: `2px solid ${color}`,
                      outlineOffset: 0,
                      font: `${TEXT_FONT_WEIGHT} ${pendingText.fontSize}px ${TEXT_FONT_FAMILY}`,
                      lineHeight: `${pendingText.fontSize * TEXT_LINE_HEIGHT}px`,
                      maxWidth: `calc(${canvasSize.width}px - ${pendingText.position.x}px)`,
                    }}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
