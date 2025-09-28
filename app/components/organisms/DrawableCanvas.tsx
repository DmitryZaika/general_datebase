import { useMemo, useState } from 'react'
import { Button } from '~/components/ui/button'

type Point = {
  x: number
  y: number
}

interface DrawableCanvasProps {
  width?: number
  height?: number
  onSubmit?: (polygons: Point[][]) => void
}

type RectShape = { kind: 'rect'; a: Point; b: Point; width: number }
type LShape = { kind: 'l'; a: Point; b: Point; c: Point; width: number }
type Shape = RectShape | LShape

// Helpers for anchor and geometry
type AnchorInfo = { point: Point; shapeIndex?: number; which?: 'a' | 'b' | 'c' }

function formatInches(value: number): string {
  const v = Math.max(0, value)
  const whole = Math.floor(v)
  const frac = v - whole
  const quarters = Math.round(frac * 4)
  const map: Record<number, string> = { 0: '', 1: '1/4', 2: '1/2', 3: '3/4', 4: '' }
  if (quarters === 0 || quarters === 4) {
    return `${quarters === 4 ? whole + 1 : whole}\"`
  }
  return `${whole} ${map[quarters]}\"`
}

function buildRectPolygonCentered(a: Point, b: Point, width: number): Point[] {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const nx = -uy
  const ny = ux
  const half = width / 2
  return [
    { x: a.x - nx * half, y: a.y - ny * half },
    { x: b.x - nx * half, y: b.y - ny * half },
    { x: b.x + nx * half, y: b.y + ny * half },
    { x: a.x + nx * half, y: a.y + ny * half },
  ]
}

function buildLPolygonCentered(a: Point, b: Point, c: Point, width: number): Point[] {
  const pdx = b.x - a.x
  const pdy = b.y - a.y
  const plen = Math.hypot(pdx, pdy) || 1
  const ux1 = { x: pdx / plen, y: pdy / plen }
  const nx1 = -ux1.y
  const ny1 = ux1.x
  const sdx = c.x - b.x
  const sdy = c.y - b.y
  const slen = Math.hypot(sdx, sdy) || 1
  const ux2 = { x: sdx / slen, y: sdy / slen }
  const nx2 = -ux2.y
  const ny2 = ux2.x
  const half = width / 2
  return [
    { x: a.x - nx1 * half, y: a.y - ny1 * half },
    { x: b.x - nx1 * half, y: b.y - ny1 * half },
    { x: b.x - nx2 * half, y: b.y - ny2 * half },
    { x: c.x - nx2 * half, y: c.y - ny2 * half },
    { x: c.x + nx2 * half, y: c.y + ny2 * half },
    { x: b.x + nx2 * half, y: b.y + ny2 * half },
    { x: b.x + nx1 * half, y: b.y + ny1 * half },
    { x: a.x + nx1 * half, y: a.y + ny1 * half },
  ]
}

export function DrawableCanvas({
  width = 800,
  height = 1000,
  onSubmit,
}: DrawableCanvasProps) {
  const [anchor, setAnchor] = useState<AnchorInfo | null>(null)
  const [hoverRaw, setHoverRaw] = useState<Point | null>(null)
  const [scale, setScale] = useState<number>(1)
  const [shapes, setShapes] = useState<Shape[]>([])
  const [editing, setEditing] = useState<{
    shapeIndex: number
    segmentIndex: number
    left: number
    top: number
    value: string
  } | null>(null)
  const RECT_WIDTH = 25.5

  const handleMouseMove: React.MouseEventHandler<SVGSVGElement> = e => {
    const rect = e.currentTarget.getBoundingClientRect()
    const raw = {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale,
    }
    setHoverRaw(raw)
  }

  const handleClick: React.MouseEventHandler<SVGSVGElement> = e => {
    const rect = e.currentTarget.getBoundingClientRect()
    const curr = {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale,
    }
    if (!anchor) {
      let picked: AnchorInfo | null = null
      const threshold = 12 / scale
      for (let i = 0; i < shapes.length; i++) {
        const s = shapes[i]
        if (s.kind === 'rect') {
          const da = Math.hypot(curr.x - s.a.x, curr.y - s.a.y)
          const db = Math.hypot(curr.x - s.b.x, curr.y - s.b.y)
          if (da <= threshold) {
            picked = { point: s.a, shapeIndex: i, which: 'a' }
            break
          }
          if (db <= threshold) {
            picked = { point: s.b, shapeIndex: i, which: 'b' }
            break
          }
        } else {
          const da = Math.hypot(curr.x - s.a.x, curr.y - s.a.y)
          const dc = Math.hypot(curr.x - s.c.x, curr.y - s.c.y)
          if (da <= threshold) {
            picked = { point: s.a, shapeIndex: i, which: 'a' }
            break
          }
          if (dc <= threshold) {
            picked = { point: s.c, shapeIndex: i, which: 'c' }
            break
          }
        }
      }
      setAnchor(picked ? picked : { point: curr })
      return
    }
    const a = anchor.point
    const dxr = curr.x - a.x
    const dyr = curr.y - a.y
    const axisIsHorizontal = Math.abs(dxr) >= Math.abs(dyr)
    const b = axisIsHorizontal ? { x: curr.x, y: a.y } : { x: a.x, y: curr.y }
    const isHorizontal = a.y === b.y
    const c = isHorizontal ? { x: b.x, y: curr.y } : { x: curr.x, y: b.y }
    const perpMag = isHorizontal ? Math.abs(c.y - b.y) : Math.abs(c.x - b.x)

    if (anchor.shapeIndex !== undefined) {
      const si = anchor.shapeIndex
      const s = shapes[si]
      if (s && s.kind === 'rect') {
        const colinear =
          (s.a.y === s.b.y && isHorizontal) || (s.a.x === s.b.x && !isHorizontal)
        if (colinear && perpMag === 0) {
          const next = { ...s }
          if (anchor.which === 'a') next.a = b
          else next.b = b
          const arr = shapes.slice()
          arr[si] = next
          setShapes(arr)
          setAnchor(null)
          setHoverRaw(null)
          return
        } else {
          const start = anchor.which === 'a' ? s.a : s.b
          const mid = axisIsHorizontal
            ? { x: curr.x, y: start.y }
            : { x: start.x, y: curr.y }
          const end = isHorizontal ? { x: mid.x, y: curr.y } : { x: curr.x, y: mid.y }
          setShapes(arr => [
            ...arr,
            { kind: 'l', a: start, b: mid, c: end, width: s.width },
          ])
          setAnchor(null)
          setHoverRaw(null)
          return
        }
      }
    }
    if (perpMag > 0) setShapes(s => [...s, { kind: 'l', a, b, c, width: RECT_WIDTH }])
    else setShapes(s => [...s, { kind: 'rect', a, b, width: RECT_WIDTH }])
    setAnchor(null)
    setHoverRaw(null)
  }

  const handleWheel: React.WheelEventHandler<SVGSVGElement> = e => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    const next = Math.max(0.25, Math.min(5, scale * factor))
    setScale(next)
  }

  const canSubmit = useMemo(() => shapes.length > 0, [shapes.length])

  const previewPoints: Point[] = useMemo(() => {
    if (!anchor || !hoverRaw) return []
    const a = anchor.point
    const dxr = hoverRaw.x - a.x
    const dyr = hoverRaw.y - a.y
    const axisIsHorizontal = Math.abs(dxr) >= Math.abs(dyr)
    const b = axisIsHorizontal ? { x: hoverRaw.x, y: a.y } : { x: a.x, y: hoverRaw.y }
    const isHorizontal = a.y === b.y
    const c = isHorizontal ? { x: b.x, y: hoverRaw.y } : { x: hoverRaw.x, y: b.y }
    const perpMag = isHorizontal ? Math.abs(c.y - b.y) : Math.abs(c.x - b.x)
    if (perpMag > 0) return buildLPolygonCentered(a, b, c, RECT_WIDTH)
    return buildRectPolygonCentered(a, b, RECT_WIDTH)
  }, [anchor, hoverRaw])

  const outlinePoints = useMemo(() => {
    if (previewPoints.length === 0) {
      return ''
    }
    return previewPoints.map(p => `${p.x},${p.y}`).join(' ')
  }, [previewPoints])

  const shapePolygons = useMemo(() => {
    return shapes.map(s =>
      s.kind === 'rect'
        ? buildRectPolygonCentered(s.a, s.b, s.width)
        : buildLPolygonCentered(s.a, s.b, s.c, s.width),
    )
  }, [shapes])

  const previewSegments = useMemo(() => {
    const src = previewPoints
    const list: { a: Point; b: Point }[] = []
    for (let i = 1; i < src.length; i++) list.push({ a: src[i - 1], b: src[i] })
    if (src.length >= 3) list.push({ a: src[src.length - 1], b: src[0] })
    return list
  }, [previewPoints])

  const previewCentroid = useMemo(() => {
    const src = previewPoints
    if (src.length === 0) return { x: 0, y: 0 }
    const sx = src.reduce((s, p) => s + p.x, 0)
    const sy = src.reduce((s, p) => s + p.y, 0)
    return { x: sx / src.length, y: sy / src.length }
  }, [previewPoints])

  const strokeW = 2 / scale

  const handleReset = () => {
    setAnchor(null)
    setHoverRaw(null)
    setShapes([])
    setEditing(null)
  }

  const handleSubmit = () => {
    if (!canSubmit) return
    if (!onSubmit) return
    const polys = shapePolygons
    onSubmit(polys)
  }

  return (
    <div className='relative w-full h-full'>
      <div className='w-full h-full'>
        <svg
          width='100%'
          height='100%'
          className='border border-gray-300 bg-white'
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverRaw(null)}
          onClick={handleClick}
          onWheel={handleWheel}
          style={{ touchAction: 'none' }}
        >
          <g transform={`scale(${scale})`}>
            {shapePolygons.map((poly, si) => (
              <polygon
                key={`poly-${si}`}
                points={poly.map(p => `${p.x},${p.y}`).join(' ')}
                fill='rgba(59,130,246,0.15)'
                stroke='#3b82f6'
                strokeWidth={strokeW}
              />
            ))}
            {outlinePoints ? (
              <polygon
                points={outlinePoints}
                fill='rgba(59,130,246,0.10)'
                stroke='#3b82f6'
                strokeWidth={strokeW}
              />
            ) : null}
            {shapePolygons.map((poly, si) => {
              const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length
              const cy = poly.reduce((s, p) => s + p.y, 0) / poly.length
              const segs: { a: Point; b: Point; idx: number }[] = []
              for (let i = 1; i < poly.length; i++)
                segs.push({ a: poly[i - 1], b: poly[i], idx: i - 1 })
              segs.push({ a: poly[poly.length - 1], b: poly[0], idx: poly.length - 1 })
              return segs.map((seg, idx) => {
                const midX = (seg.a.x + seg.b.x) / 2
                const midY = (seg.a.y + seg.b.y) / 2
                const length = Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y)
                const dirToOutsideX = midX - cx
                const dirToOutsideY = midY - cy
                const dlen = Math.hypot(dirToOutsideX, dirToOutsideY) || 1
                const off = (RECT_WIDTH + 12) / scale
                const tx = midX + (dirToOutsideX / dlen) * off
                const ty = midY + (dirToOutsideY / dlen) * off
                return (
                  <text
                    key={`seglabel-${si}-${idx}`}
                    x={tx}
                    y={ty}
                    fontSize={12 / scale}
                    fill='#111827'
                    stroke='#ffffff'
                    strokeWidth={3 / scale}
                    textAnchor='middle'
                    paintOrder='stroke'
                    onClick={ev => {
                      ev.stopPropagation()
                      setEditing({
                        shapeIndex: si,
                        segmentIndex: seg.idx,
                        left: tx * scale,
                        top: ty * scale,
                        value: length.toFixed(1),
                      })
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {length.toFixed(1)}
                  </text>
                )
              })
            })}
            {previewSegments.map((seg, idx) => {
              const midX = (seg.a.x + seg.b.x) / 2
              const midY = (seg.a.y + seg.b.y) / 2
              const length = Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y)
              const dirToOutsideX = midX - previewCentroid.x
              const dirToOutsideY = midY - previewCentroid.y
              const dlen = Math.hypot(dirToOutsideX, dirToOutsideY) || 1
              const off = (RECT_WIDTH + 12) / scale
              const tx = midX + (dirToOutsideX / dlen) * off
              const ty = midY + (dirToOutsideY / dlen) * off
              return (
                <text
                  key={`preview-seg-${idx}`}
                  x={tx}
                  y={ty}
                  fontSize={12 / scale}
                  fill='#111827'
                  stroke='#ffffff'
                  strokeWidth={3 / scale}
                  textAnchor='middle'
                  paintOrder='stroke'
                >
                  {length.toFixed(1)}
                </text>
              )
            })}
          </g>
        </svg>
        <div className='absolute top-2 right-2 text-xs bg-white/80 rounded px-2 py-1 border border-gray-300 pointer-events-none'>
          {Math.round(scale * 100)}%
        </div>
      </div>
      <div className='absolute left-2 bottom-2 flex items-center gap-2'>
        <Button variant='secondary' onClick={handleReset}>
          Reset
        </Button>
        <Button disabled={!canSubmit} onClick={handleSubmit}>
          Submit
        </Button>
      </div>
      {editing ? (
        <div className='absolute' style={{ left: editing.left, top: editing.top }}>
          <input
            value={editing.value}
            onChange={e => setEditing({ ...editing, value: e.target.value })}
            onBlur={() => {
              const num = Number(editing.value)
              if (!Number.isFinite(num)) {
                setEditing(null)
                return
              }
              const si = editing.shapeIndex
              const segIdx = editing.segmentIndex
              const shape = shapes[si]
              if (!shape) {
                setEditing(null)
                return
              }
              if (shape.kind === 'rect') {
                const a = shape.a
                const b = shape.b
                const dx = b.x - a.x
                const dy = b.y - a.y
                const len = Math.hypot(dx, dy) || 1
                const ux = dx / len
                const uy = dy / len
                const nx = -uy
                const ny = ux
                const poly = [
                  a,
                  b,
                  { x: b.x + nx * shape.width, y: b.y + ny * shape.width },
                  { x: a.x + nx * shape.width, y: a.y + ny * shape.width },
                ]
                const vdx = poly[(segIdx + 1) % 4].x - poly[segIdx].x
                const vdy = poly[(segIdx + 1) % 4].y - poly[segIdx].y
                const dotPrimary = Math.abs(vdx * ux + vdy * uy)
                const dotNormal = Math.abs(vdx * nx + vdy * ny)
                if (dotPrimary >= dotNormal) {
                  const sign = Math.sign(dx || 0 + dy || 0) || 1
                  const newB = { x: a.x + ux * num * sign, y: a.y + uy * num * sign }
                  const next = {
                    kind: 'rect',
                    a,
                    b: newB,
                    width: shape.width,
                  } as RectShape
                  const arr = shapes.slice()
                  arr[si] = next
                  setShapes(arr)
                } else {
                  const next = {
                    kind: 'rect',
                    a: shape.a,
                    b: shape.b,
                    width: num,
                  } as RectShape
                  const arr = shapes.slice()
                  arr[si] = next
                  setShapes(arr)
                }
              } else {
                const a = shape.a
                const b = shape.b
                const c = shape.c
                const pdx = b.x - a.x
                const pdy = b.y - a.y
                const plen = Math.hypot(pdx, pdy) || 1
                const pux = pdx / plen
                const puy = pdy / plen
                const pnx = -puy
                const pny = pux
                const sdx = c.x - b.x
                const sdy = c.y - b.y
                const slen = Math.hypot(sdx, sdy) || 1
                const sux = sdx / slen
                const suy = sdy / slen
                const snx = -suy
                const sny = sux
                const poly = [
                  a,
                  b,
                  c,
                  { x: c.x + snx * shape.width, y: c.y + sny * shape.width },
                  { x: b.x + snx * shape.width, y: b.y + sny * shape.width },
                  { x: b.x + pnx * shape.width, y: b.y + pny * shape.width },
                  { x: a.x + pnx * shape.width, y: a.y + pny * shape.width },
                ]
                const vdx = poly[(segIdx + 1) % poly.length].x - poly[segIdx].x
                const vdy = poly[(segIdx + 1) % poly.length].y - poly[segIdx].y
                const dPrimary = Math.abs(vdx * pux + vdy * puy)
                const dSecondary = Math.abs(vdx * sux + vdy * suy)
                const dWidth = Math.max(
                  Math.abs(vdx * pnx + vdy * pny),
                  Math.abs(vdx * snx + vdy * sny),
                )
                if (dPrimary >= dSecondary && dPrimary >= dWidth) {
                  const sign = Math.sign(pdx || 0 + pdy || 0) || 1
                  const newB = { x: a.x + pux * num * sign, y: a.y + puy * num * sign }
                  const next = {
                    kind: 'l',
                    a,
                    b: newB,
                    c: shape.c,
                    width: shape.width,
                  } as LShape
                  const arr = shapes.slice()
                  arr[si] = next
                  setShapes(arr)
                } else if (dSecondary >= dPrimary && dSecondary >= dWidth) {
                  const sign = Math.sign(sdx || 0 + sdy || 0) || 1
                  const newC = { x: b.x + sux * num * sign, y: b.y + suy * num * sign }
                  const next = {
                    kind: 'l',
                    a,
                    b,
                    c: newC,
                    width: shape.width,
                  } as LShape
                  const arr = shapes.slice()
                  arr[si] = next
                  setShapes(arr)
                } else {
                  const next = {
                    kind: 'l',
                    a: shape.a,
                    b: shape.b,
                    c: shape.c,
                    width: num,
                  } as LShape
                  const arr = shapes.slice()
                  arr[si] = next
                  setShapes(arr)
                }
              }
              setEditing(null)
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'Escape') setEditing(null)
            }}
            className='border border-gray-300 rounded px-1 py-0.5 text-xs bg-white'
            style={{ width: 64 }}
            autoFocus
          />
        </div>
      ) : null}
    </div>
  )
}
