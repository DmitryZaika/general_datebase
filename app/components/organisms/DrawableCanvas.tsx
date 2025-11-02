import { useState } from 'react'
import { Button } from '~/components/ui/button'

const FIXED_HEIGHT = 100

type Point = { x: number; y: number }

interface DrawableCanvasProps {
  onSubmit?: (paths: Point[][]) => void
}

enum Direction {
  UP,
  DOWN,
  LEFT,
  RIGHT,
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

const toLocal = (
  e: React.MouseEvent<SVGSVGElement, MouseEvent>,
  offsetX: number = 0,
  offsetY: number = 0,
) => {
  const rect = e.currentTarget.getBoundingClientRect()
  return { x: e.clientX - rect.left + offsetX, y: e.clientY - rect.top + offsetY }
}

function DrawableCanvas({ onSubmit }: DrawableCanvasProps) {
  const [shapes, setShapes] = useState<Shape[]>([])
  const [currentShape, setCurrentShape] = useState<Shape>([])
  const [level, setLevel] = useState<number>(1)

  const handleReset = () => {
    setShapes([])
    setCurrentShape([])
  }

  const handleDragStart: React.MouseEventHandler<SVGSVGElement> = e => {
    const top = toLocal(e, 0, -(FIXED_HEIGHT / 2))
    const bottom = toLocal(e, 0, FIXED_HEIGHT / 2)
    setCurrentShape([top, bottom])
  }

  const handleTurn = (current: Point) => {
    console.log('turn')
  }

  const handleMove: React.MouseEventHandler<SVGSVGElement> = e => {
    if (currentShape.length === 0) return
    const current = toLocal(e)
    let inner: Point[]
    if (currentShape.length === level * 2) {
      inner = currentShape
    } else {
      inner = currentShape.slice(1, -1)
    }
    if (current.y < inner[0].y || current.y > inner[1].y) {
      handleTurn(current)
    }
    const top = { ...current, y: inner[0].y }
    const bottom = { ...current, y: inner[1].y }
    setCurrentShape([top, ...inner, bottom])
  }

  const handleDragEnd: React.MouseEventHandler<SVGSVGElement> = e => {
    setShapes(shapes => [...shapes, currentShape])
    setCurrentShape([])
  }

  const handleSubmit = () => {
    if (!onSubmit) return
    onSubmit(shapes)
  }

  return (
    <div className='fixed inset-0 bg-white'>
      <svg
        className='w-[95%] h-[80%] cursor-crosshair border-2 border-green-500 ml-4 mt-4'
        onMouseMove={handleMove}
        onMouseDown={handleDragStart}
        onMouseUp={handleDragEnd}
      >
        <g>
          <CompletedShapes shapes={shapes} />
          {currentShape.length > 0 ? (
            <polyline
              points={currentShape.map(p => `${p.x},${p.y}`).join(' ')}
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

export { DrawableCanvas }
