import { useState } from 'react';
import { Button } from '~/components/ui/button';

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
  const [turned, setTurned] = useState<boolean>(false)

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
    setLevel(Level => Level + 1)
    const last = currentShape.length - 1
    const newShape = currentShape.map((item, idx) => idx === last ?{ x: item.x - FIXED_HEIGHT, y: item.y} : item)
    const finalShape = [{ x: currentShape[0].x, y: current.y}, ...newShape, { x: currentShape[last].x, y: current.y}]
    setCurrentShape(finalShape)
  }

  const isInBounds = (current: Point, inner: Point[]) => {
    console.log(level)
    if (level % 2 === 1) return (current.y > inner[0].y && current.y < inner[inner.length - 1].y)
    return (current.y > inner[inner.length - 1].y && current.y < inner[0].y)
  }

  const handleMove: React.MouseEventHandler<SVGSVGElement> = e => {
    if (currentShape.length === 0) return
    const current = toLocal(e);

    let inner: Point[]
    if (currentShape.length === level * 2) {
      inner = currentShape
    } else {
      inner = currentShape.slice(1, -1)
    }

    if (inner.length > 0 && !isInBounds(current, inner) && !turned) {
      console.log('not in bounds')
      handleTurn(current)
      setTurned(true)
      return
    }

    let top, bottom: Point
    if (level % 2 === 1) {
      top = { ...current, y: inner[0].y }
      bottom = { ...current, y: inner[1].y }
    } else {
      top = { ...current, x: inner[0].x }
      bottom = { ...current, x: inner[inner.length - 1].x }
    }
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
          {currentShape.length > 0
            ? currentShape.map((p, idx) => (
                <text
                  key={`pt-${idx}`}
                  x={p.x + 6}
                  y={p.y - 6}
                  className='text-[12px] text-gray-800 select-none'
                  fill='currentColor'
                >
                  {idx}
                </text>
              ))
            : null}
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

