import { useMemo, useState } from 'react';
import { Button } from '~/components/ui/button';

type Point = { x: number; y: number }

interface DrawableCanvasProps {
  onSubmit?: (paths: Point[][]) => void
}

type Shape = Point[]

function CompletedShapes({ shapes }: { shapes: Shape[] }) {
  return (
    <>
      {shapes.map((shape, i) => (
        <polygon
          key={`p-${i}`}
          points={shape.map(p => `${p.x},${p.y}`).join(' ')}
          fill='rgba(59,130,246,0.15)'
          stroke='#3b82f6'
          strokeWidth={2}
        />
      ))}
    </>
  )
}

const toLocal = (e: React.MouseEvent<SVGSVGElement, MouseEvent>, offsetX: number = 0, offsetY: number = 0) => {
  const rect = e.currentTarget.getBoundingClientRect()
  return { x: e.clientX - rect.left + offsetX, y: e.clientY - rect.top + offsetY }
}

function DrawableCanvas({ onSubmit }: DrawableCanvasProps) {
  const [shapes, setShapes] = useState<Shape[]>([])
  const [currentShape, setCurrentShape] = useState<Shape>([])
  const [hover, setHover] = useState<Point | null>(null)

  const handleReset = () => {
    setShapes([])
    setCurrentShape([])
    setHover(null)
  }

  const handleMove: React.MouseEventHandler<SVGSVGElement> = e => {
    if (currentShape.length === 0) return
    const p = toLocal(e)
    setHover(p)
  }

  const handleClick: React.MouseEventHandler<SVGSVGElement> = e => {
    const p = toLocal(e)
    setCurrentShape([...currentShape, p])
  }

  const handleDoubleClick: React.MouseEventHandler<SVGSVGElement> = () => {
    if (currentShape.length >= 3) {
      setShapes([...shapes, currentShape])
      setCurrentShape([])
      setHover(null)
    }
  }

  const handleSubmit = () => {
    if (!onSubmit) return
    onSubmit(shapes)
  }

  const previewPoints: Point[] = useMemo(() => {
    if (currentShape.length === 0) return []
    if (!hover) return currentShape
    return [...currentShape, hover]
  }, [currentShape, hover])

  return (
    <div className='fixed inset-0 bg-white'>
      <svg
        className='w-[1000px] h-[500px] cursor-crosshair border-2 border-green-500 ml-24 mt-24'
        onMouseMove={handleMove}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        <g>
          <CompletedShapes shapes={shapes} />
          {previewPoints.length > 0 ? (
            <polyline
              points={previewPoints.map(p => `${p.x},${p.y}`).join(' ')}
              fill='none'
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

export { DrawableCanvas };

