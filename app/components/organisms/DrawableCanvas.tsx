import { useState } from 'react';
import { Button } from '~/components/ui/button';

const FIXED_HEIGHT = 100
const TURN_THRESHOLD = 50

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

  const handleTurnPoint = (idx: number, item: Point, length: number, above: boolean, ascending: boolean) => {
    const toChange = !above ? idx === 0 : (idx === length - 1);
    if (!toChange) return item
    if (level % 2 === 1) {
      return { ...item, x: item.x  + (ascending ? FIXED_HEIGHT : -FIXED_HEIGHT) }
    }
    return { ...item, y: item.y + (ascending ? FIXED_HEIGHT : -FIXED_HEIGHT) }
  }

  const handleTurn = (current: Point) => {
    setLevel(Level => Level + 1)
    const first = currentShape[0]
    const second = currentShape[1]
    const ascending = level % 2 === 1 ? second.x > first.x : second.y > first.y
    const last = currentShape[currentShape.length - 1]
    const points = level % 2 === 1 ? [first.y, last.y] : [first.x, last.x]
    const currentCoord = level % 2 === 1 ? current.y : current.x
    const above = currentCoord > points[0]
    const newShape = currentShape.map((item, idx, arr) => handleTurnPoint(idx, item, arr.length, above, ascending))
    setCurrentShape(newShape)
  }

  const isInBounds = (current: Point, inner: Point[]) => {
    const bounds = level % 2 === 1 ? [inner[0].y, inner[inner.length - 1].y] : [inner[inner.length - 1].x, inner[0].x]
    bounds.sort((a, b) => a - b)
    const currentCoord = level % 2 === 1 ? current.y : current.x
    const threshold = Math.min(currentCoord - bounds[0], bounds[1]  - currentCoord)
    return threshold >= -TURN_THRESHOLD
  }

  const isInOldBounds = (current: Point, inner: Point[]) => {
    const oldLevel = level - 1
    const bounds = oldLevel % 2 === 1 ? [inner[1].y, inner[inner.length - 2].y] : [inner[inner.length - 2].x, inner[1].x]
    bounds.sort((a, b) => a - b)
    const currentCoord = oldLevel % 2 === 1 ? current.y : current.x
    const threshold = Math.min(currentCoord - bounds[0], bounds[1]  - currentCoord)
    return threshold >= -TURN_THRESHOLD
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

    if (inner.length > 3 && isInOldBounds(current, inner)) {
      inner = inner.slice(1, -1)
      setLevel(Level => Level - 1)
    } else if (inner.length > 0 && !isInBounds(current, inner)) {
      handleTurn(current)
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

