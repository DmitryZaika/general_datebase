import { useMemo, useState } from 'react'
import { Button } from '~/components/ui/button'

type Point = { x: number; y: number }

interface DrawableCanvasProps {
  onSubmit?: (paths: Point[][]) => void
}

type Rect = { left: number; right: number; top: number; bottom: number }

const FIXED_HEIGHT = 200

function DrawableCanvas({ onSubmit }: DrawableCanvasProps) {
  const [shapes, setShapes] = useState<Rect[]>([])
  const [start, setStart] = useState<Point | null>(null)
  const [hoverX, setHoverX] = useState<number | null>(null)

  const handleReset = () => {
    setShapes([])
    setStart(null)
    setHoverX(null)
  }

  const handleSubmit = () => {
    if (!onSubmit) return
    const polys: Point[][] = shapes.map((r: Rect) => [
      { x: r.left, y: r.top },
      { x: r.right, y: r.top },
      { x: r.right, y: r.bottom },
      { x: r.left, y: r.bottom },
    ])
    onSubmit(polys)
  }

  const toLocal = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const handleMove: React.MouseEventHandler<SVGSVGElement> = e => {
    if (!start) return
    const p = toLocal(e)
    setHoverX(p.x)
  }

  const handleClick: React.MouseEventHandler<SVGSVGElement> = e => {
    const p = toLocal(e)
    if (!start) {
      setStart(p)
      setHoverX(p.x)
      return
    }
    const left = Math.min(start.x, p.x)
    const right = Math.max(start.x, p.x)
    const top = start.y
    const bottom = start.y + FIXED_HEIGHT
    setShapes([...shapes, { left, right, top, bottom }])
    setStart(null)
    setHoverX(null)
  }

  const preview: Rect | null = useMemo(() => {
    if (!start || hoverX === null) return null
    const left = Math.min(start.x, hoverX)
    const right = Math.max(start.x, hoverX)
    return { left, right, top: start.y, bottom: start.y + FIXED_HEIGHT }
  }, [start, hoverX])

  return (
    <div className='fixed inset-0 bg-white'>
      <svg
        className='w-[200px] h-[200px] cursor-crosshair'
        onMouseMove={handleMove}
        onClick={handleClick}
      >
        <g>
          {shapes.map((r: Rect, i: number) => (
            <rect
              key={`r-${i}`}
              x={r.left}
              y={r.top}
              width={r.right - r.left}
              height={r.bottom - r.top}
              fill='rgba(59,130,246,0.15)'
              stroke='#3b82f6'
              strokeWidth={2}
            />
          ))}
          {preview ? (
            <rect
              x={preview.left}
              y={preview.top}
              width={preview.right - preview.left}
              height={preview.bottom - preview.top}
              fill='rgba(96,165,250,0.15)'
              stroke='#60a5fa'
              strokeWidth={2}
            />
          ) : null}
        </g>
      </svg>
      <div className='absolute left-3 bottom-3 flex items-center gap-2'>
        <Button variant='secondary' onClick={handleReset}>
          Reset
        </Button>
        <Button onClick={handleSubmit}>Submit</Button>
      </div>
    </div>
  )
}

export { DrawableCanvas }
