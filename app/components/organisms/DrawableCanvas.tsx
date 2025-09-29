import { useEffect, useMemo, useRef, useState } from 'react'
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

type TurnLock = {
    point: Point
    axis: 'h' | 'v'
    side: 'a' | 'b' | 'start'
}

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
    const outerCorner = { x: b.x - nx1 * half - nx2 * half, y: b.y - ny1 * half - ny2 * half }
    const innerCorner = { x: b.x + nx1 * half + nx2 * half, y: b.y + ny1 * half + ny2 * half }
    // Order points clockwise to avoid inner diagonal overlap
    return [
        { x: a.x - nx1 * half, y: a.y - ny1 * half },
        { x: b.x - nx1 * half, y: b.y - ny1 * half },
        outerCorner,
        { x: c.x - nx2 * half, y: c.y - ny2 * half },
        { x: c.x + nx2 * half, y: c.y + ny2 * half },
        innerCorner,
        { x: a.x + nx1 * half, y: a.y + ny1 * half },
    ]
}

const TURN_THRESHOLD = 20

function getAxisFromPoints(a: Point, b: Point): 'h' | 'v' {
    return Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? 'h' : 'v'
}

function alignPoint(point: Point, reference: Point, axis: 'h' | 'v'): Point {
    return axis === 'h' ? { x: point.x, y: reference.y } : { x: reference.x, y: point.y }
}

function computeRectPreview(
    rect: RectShape,
    side: 'a' | 'b',
    hover: Point,
    axisHint: 'h' | 'v' | null,
    lockedAligned: Point | null,
): { shape: Shape; axis: 'h' | 'v'; perpendicular: number; aligned: Point } {
    const axis = axisHint ?? getAxisFromPoints(rect.a, rect.b)
    const reference = side === 'b' ? rect.b : rect.a
    const alignedCandidate = alignPoint(hover, reference, axis)
    const aligned = lockedAligned ?? alignedCandidate
    const perpendicular = axis === 'h' ? Math.abs(hover.y - reference.y) : Math.abs(hover.x - reference.x)
    const corner = axis === 'h' ? { x: aligned.x, y: hover.y } : { x: hover.x, y: aligned.y }
    if (perpendicular >= TURN_THRESHOLD) {
        if (side === 'b') {
            return {
                shape: { kind: 'l', a: rect.a, b: aligned, c: corner, width: rect.width },
                axis,
                perpendicular,
                aligned,
            }
        }
        return {
            shape: { kind: 'l', a: corner, b: aligned, c: rect.b, width: rect.width },
            axis,
            perpendicular,
            aligned,
        }
    }
    if (side === 'b') {
        return {
            shape: { kind: 'rect', a: rect.a, b: aligned, width: rect.width },
            axis,
            perpendicular,
            aligned,
        }
    }
    return {
        shape: { kind: 'rect', a: aligned, b: rect.b, width: rect.width },
        axis,
        perpendicular,
        aligned,
    }
}

function computeLPreview(
    shape: LShape,
    side: 'a' | 'c',
    hover: Point,
    axisHint: 'h' | 'v' | null,
): { shape: Shape; axis: 'h' | 'v'; perpendicular: number } {
    if (side === 'a') {
        const axis = axisHint ?? getAxisFromPoints(shape.a, shape.b)
        const aligned = alignPoint(hover, shape.a, axis)
        return {
            shape: { ...shape, a: aligned },
            axis,
            perpendicular: 0,
        }
    }
    const axis = axisHint ?? getAxisFromPoints(shape.b, shape.c)
    const aligned = alignPoint(hover, shape.c, axis)
    return {
        shape: { ...shape, c: aligned },
        axis,
        perpendicular: 0,
    }
}

function computePreviewShape(
    shapes: Shape[],
    anchor: AnchorInfo | null,
    hover: Point | null,
    dragAxis: 'h' | 'v' | null,
    defaultWidth: number,
    turnLock: TurnLock | null,
): { shape: Shape; axis: 'h' | 'v'; aligned?: Point } | null {
    if (!anchor || !hover) return null
    if (anchor.shapeIndex !== undefined) {
        const base = shapes[anchor.shapeIndex]
        if (!base) return null
        if (base.kind === 'rect') {
            const locked = turnLock ? turnLock.point : dragAxis ? (anchor.which === 'b' ? base.b : base.a) : null
            const preview = computeRectPreview(base, anchor.which === 'b' ? 'b' : 'a', hover, dragAxis, locked)
            return { shape: preview.shape, axis: preview.axis, aligned: preview.aligned }
        }
        const preview = computeLPreview(base, anchor.which === 'c' ? 'c' : 'a', hover, dragAxis)
        return { shape: preview.shape, axis: preview.axis }
    }
    const axis = turnLock ? turnLock.axis : dragAxis ?? getAxisFromPoints(anchor.point, hover)
    const alignedBase = alignPoint(hover, anchor.point, axis)
    const aligned = turnLock ? turnLock.point : alignedBase
    const corner = axis === 'h' ? { x: aligned.x, y: hover.y } : { x: hover.x, y: aligned.y }
    const perpendicular = axis === 'h' ? Math.abs(corner.y - aligned.y) : Math.abs(corner.x - aligned.x)
    if (perpendicular >= TURN_THRESHOLD) {
        return { shape: { kind: 'l', a: anchor.point, b: aligned, c: corner, width: defaultWidth }, axis, aligned }
    }
    return { shape: { kind: 'rect', a: anchor.point, b: aligned, width: defaultWidth }, axis, aligned }
}

const pointsToPolygon = (points: Point[]): string => points.map(p => `${p.x},${p.y}`).join(' ')

const nearlyEqual = (a: number, b: number, tolerance = 0.001) => Math.abs(a - b) <= tolerance

const alignedEquals = (a: Point, b: Point, axis: 'h' | 'v', tolerance = 0.001) =>
    axis === 'h' ? nearlyEqual(a.y, b.y, tolerance) : nearlyEqual(a.x, b.x, tolerance)

const buildPreviewPolygon = (shape: Shape): Point[] =>
    shape.kind === 'rect' ? buildRectPolygonCentered(shape.a, shape.b, shape.width) : buildLPolygonCentered(shape.a, shape.b, shape.c, shape.width)

export function DrawableCanvas({ width = 800, height = 1000, onSubmit }: DrawableCanvasProps) {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const [availableH, setAvailableH] = useState<number | null>(null)
    const [anchor, setAnchor] = useState<AnchorInfo | null>(null)
    const [hoverRaw, setHoverRaw] = useState<Point | null>(null)
    const [scale, setScale] = useState<number>(3.63)
    const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
    const [isPanning, setIsPanning] = useState<boolean>(false)
    const panStartRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)
    const [draggingShape, setDraggingShape] = useState<{ index: number; start: Point } | null>(null)
    const dragStartRef = useRef<{ sx: number; sy: number; shape: Shape } | null>(null)
    const skipNextClickRef = useRef<boolean>(false)
    const [shapes, setShapes] = useState<Shape[]>([])
    const [editing, setEditing] = useState<{ shapeIndex: number; segmentIndex: number; left: number; top: number; value: string } | null>(null)
    const [dragAxis, setDragAxis] = useState<'h' | 'v' | null>(null)
    const [hoverHandle, setHoverHandle] = useState<{ shapeIndex: number; which: 'a' | 'b' | 'c'; axis: 'h' | 'v' } | null>(null)
    const [turnLock, setTurnLock] = useState<TurnLock | null>(null)
    const RECT_WIDTH = 25.5

    const screenToWorld = (sx: number, sy: number): Point => ({ x: (sx - pan.x) / scale, y: (sy - pan.y) / scale })

    useEffect(() => {
        const update = () => {
            if (!containerRef.current) return
            const rect = containerRef.current.getBoundingClientRect()
            const h = Math.max(0, window.innerHeight - rect.top)
            setAvailableH(h)
        }
        update()
        window.addEventListener('resize', update)
        return () => window.removeEventListener('resize', update)
    }, [])

    const handleMouseMove: React.MouseEventHandler<SVGSVGElement> = (e) => {
        if (isPanning && panStartRef.current) {
            const dx = e.clientX - panStartRef.current.sx
            const dy = e.clientY - panStartRef.current.sy
            setPan({ x: panStartRef.current.ox + dx, y: panStartRef.current.oy + dy })
            return
        }
        if (draggingShape && dragStartRef.current) {
            const dxWorld = (e.clientX - dragStartRef.current.sx) / scale
            const dyWorld = (e.clientY - dragStartRef.current.sy) / scale
            const idx = draggingShape.index
            const original = dragStartRef.current.shape
            const updated: Shape = original.kind === 'rect'
              ? { kind: 'rect', a: { x: original.a.x + dxWorld, y: original.a.y + dyWorld }, b: { x: original.b.x + dxWorld, y: original.b.y + dyWorld }, width: original.width }
              : { kind: 'l', a: { x: original.a.x + dxWorld, y: original.a.y + dyWorld }, b: { x: original.b.x + dxWorld, y: original.b.y + dyWorld }, c: { x: original.c.x + dxWorld, y: original.c.y + dyWorld }, width: original.width }
            const arr = shapes.slice()
            arr[idx] = updated
            setShapes(arr)
            return
        }
        const rect = e.currentTarget.getBoundingClientRect()
        const raw = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
        setHoverRaw(raw)
        // endpoint hover detection for cursor
        const threshold = 12 / scale
        let hh: { shapeIndex: number; which: 'a' | 'b' | 'c'; axis: 'h' | 'v' } | null = null
        for (let i = 0; i < shapes.length; i++) {
            const s = shapes[i]
            if (s.kind === 'rect') {
                const nearA = Math.hypot(raw.x - s.a.x, raw.y - s.a.y) <= threshold
                const nearB = Math.hypot(raw.x - s.b.x, raw.y - s.b.y) <= threshold
                const axis: 'h' | 'v' = Math.abs(s.b.y - s.a.y) < Math.abs(s.b.x - s.a.x) ? 'h' : 'v'
                if (nearA) { hh = { shapeIndex: i, which: 'a', axis }; break }
                if (nearB) { hh = { shapeIndex: i, which: 'b', axis }; break }
            } else {
                const nearA = Math.hypot(raw.x - s.a.x, raw.y - s.a.y) <= threshold
                const nearC = Math.hypot(raw.x - s.c.x, raw.y - s.c.y) <= threshold
                const axisA: 'h' | 'v' = Math.abs(s.b.y - s.a.y) < Math.abs(s.b.x - s.a.x) ? 'h' : 'v'
                const axisC: 'h' | 'v' = Math.abs(s.c.y - s.b.y) < Math.abs(s.c.x - s.b.x) ? 'h' : 'v'
                if (nearA) { hh = { shapeIndex: i, which: 'a', axis: axisA }; break }
                if (nearC) { hh = { shapeIndex: i, which: 'c', axis: axisC }; break }
            }
        }
        setHoverHandle(hh)
        if (anchor) {
            const a = anchor.point
            const dx = raw.x - a.x
            const dy = raw.y - a.y
            const absX = Math.abs(dx)
            const absY = Math.abs(dy)
            const desired: 'h' | 'v' = absX >= absY ? 'h' : 'v'
            const threshold = 1.6
            if (dragAxis === null) {
                if (Math.max(absX, absY) > 1) setDragAxis(desired)
            } else if (dragAxis !== desired) {
                const dom = desired === 'h' ? absX : absY
                const oth = desired === 'h' ? absY : absX
                if (dom > threshold * Math.max(oth, 0.0001)) setDragAxis(desired)
            }
            const axis = turnLock ? turnLock.axis : dragAxis ?? desired
            const referencePoint = anchor.shapeIndex !== undefined
                ? (() => {
                    const anchoredShape = shapes[anchor.shapeIndex]
                    if (!anchoredShape) return anchor.point
                    if (anchoredShape.kind === 'rect') return anchor.which === 'b' ? anchoredShape.b : anchoredShape.a
                    if (anchor.which === 'c') return anchoredShape.c
                    if (anchor.which === 'a') return anchoredShape.a
                    return anchor.point
                })()
                : anchor.point
            const perp = axis === 'h' ? Math.abs(raw.y - referencePoint.y) : Math.abs(raw.x - referencePoint.x)
            if (!turnLock && perp >= TURN_THRESHOLD) {
                const aligned = alignPoint(raw, referencePoint, axis)
                const side: TurnLock['side'] = anchor.shapeIndex !== undefined ? (anchor.which === 'b' ? 'b' : 'a') : 'start'
                setTurnLock({ point: aligned, axis, side })
                setDragAxis(axis)
            } else if (turnLock && perp < TURN_THRESHOLD - 2) {
                setTurnLock(null)
                setDragAxis(axis)
            } else if (!turnLock) {
                setDragAxis(axis)
            }
        } else {
            if (dragAxis !== null) setDragAxis(null)
            if (turnLock) setTurnLock(null)
        }
    }

    const handleClick: React.MouseEventHandler<SVGSVGElement> = (e) => {
        if (skipNextClickRef.current) { skipNextClickRef.current = false; return }
        if (isPanning) return
        const rect = e.currentTarget.getBoundingClientRect()
        const curr = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
        if (!anchor) {
            if (hoverHandle) {
                const s = shapes[hoverHandle.shapeIndex]
                const which = hoverHandle.which
                const point = which === 'a' ? (s.kind === 'rect' || which === 'a' ? s.a : s.a) : which === 'b' ? (s as any).b : (s as any).c
                setAnchor({ point, shapeIndex: hoverHandle.shapeIndex, which })
                setDragAxis(hoverHandle.axis)
                return
            }
            let picked: AnchorInfo | null = null
            const threshold = 12 / scale
            for (let i = 0; i < shapes.length; i++) {
                const s = shapes[i]
                if (s.kind === 'rect') {
                    const da = Math.hypot(curr.x - s.a.x, curr.y - s.a.y)
                    const db = Math.hypot(curr.x - s.b.x, curr.y - s.b.y)
                    if (da <= threshold) { picked = { point: s.a, shapeIndex: i, which: 'a' }; break }
                    if (db <= threshold) { picked = { point: s.b, shapeIndex: i, which: 'b' }; break }
                } else {
                    const da = Math.hypot(curr.x - s.a.x, curr.y - s.a.y)
                    const db = Math.hypot(curr.x - s.b.x, curr.y - s.b.y)
                    const dc = Math.hypot(curr.x - s.c.x, curr.y - s.c.y)
                    if (da <= threshold) { picked = { point: s.a, shapeIndex: i, which: 'a' }; break }
                    if (db <= threshold) { picked = { point: s.b, shapeIndex: i, which: 'b' }; break }
                    if (dc <= threshold) { picked = { point: s.c, shapeIndex: i, which: 'c' }; break }
                }
            }
            setAnchor(picked ? picked : { point: curr })
            return
        }

        const preview = computePreviewShape(shapes, anchor, curr, dragAxis, RECT_WIDTH, turnLock)
        if (!preview) {
            setAnchor(null); setHoverRaw(null); setDragAxis(null); setTurnLock(null)
            return
        }

       

        if (anchor.shapeIndex !== undefined) {
            const arr = shapes.slice()
            arr[anchor.shapeIndex] = preview.shape
            setShapes(arr)
        } else {
            setShapes(prev => [...prev, preview.shape])
        }
        setAnchor(null)
        setHoverRaw(null)
        setDragAxis(null)
        setTurnLock(null)
    }

    const handleWheel: React.WheelEventHandler<SVGSVGElement> = e => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    const next = Math.max(0.25, Math.min(5, scale * factor))
    setScale(next)
  }

  const pointInPolygon = (pt: Point, poly: Point[]): boolean => {
    let inside = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y
      const xj = poly[j].x, yj = poly[j].y
      const intersect = yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 0.000001) + xi
      if (intersect) inside = !inside
    }
    return inside
  }

  const handleMouseDown: React.MouseEventHandler<SVGSVGElement> = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
    const hitIndex = shapePolygons.findIndex(poly => pointInPolygon(world, poly))
    if (e.button === 1 || e.ctrlKey) {
      setIsPanning(true)
      panStartRef.current = { sx: e.clientX, sy: e.clientY, ox: pan.x, oy: pan.y }
      return
    }
    if (hitIndex >= 0 && !hoverHandle) {
      setDraggingShape({ index: hitIndex, start: world })
      dragStartRef.current = { sx: e.clientX, sy: e.clientY, shape: shapes[hitIndex] }
    }
  }

  const handleMouseUp: React.MouseEventHandler<SVGSVGElement> = () => {
    setIsPanning(false)
    panStartRef.current = null
    if (draggingShape) {
      setDraggingShape(null)
      dragStartRef.current = null
      skipNextClickRef.current = true
    }
  }

  const canSubmit = useMemo(() => shapes.length > 0, [shapes.length])

  const previewInfo = useMemo(() => computePreviewShape(shapes, anchor, hoverRaw, dragAxis, RECT_WIDTH, turnLock), [shapes, anchor, hoverRaw, dragAxis, turnLock])

  const previewPoints: Point[] = useMemo(() => (previewInfo ? buildPreviewPolygon(previewInfo.shape) : []), [previewInfo])

  const outlinePoints = useMemo(() => {
    if (previewPoints.length === 0) {
      return ''
    }
    return previewPoints.map(p => `${p.x},${p.y}`).join(' ')
  }, [previewPoints])

  const shapePolygons = useMemo(() => {
    return shapes.flatMap(s =>
      s.kind === 'rect'
        ? [buildRectPolygonCentered(s.a, s.b, s.width)]
        : [buildLPolygonCentered(s.a, s.b, s.c, s.width)],
    )
  }, [shapes])

  const previewSegments = useMemo(() => {
    if (previewInfo) return []
    const src = previewPoints
    const list: { a: Point; b: Point }[] = []
    for (let i = 1; i < src.length; i++) list.push({ a: src[i - 1], b: src[i] })
    if (src.length >= 3) list.push({ a: src[src.length - 1], b: src[0] })
    return list
  }, [previewPoints, previewInfo])

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
    setDragAxis(null)
    setTurnLock(null)
  }

  const handleSubmit = () => {
    if (!canSubmit) return
    if (!onSubmit) return
    const polys = shapePolygons
    onSubmit(polys)
  }

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: availableH ? `${availableH}px` : '100%' }}>
      <div className="w-full h-full">
        <svg
          width='100%'
          height='100%'
          className='border border-gray-300 bg-white'
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => setHoverRaw(null)}
          onClick={handleClick}
          onWheel={handleWheel}
          style={{ touchAction: 'none', cursor: isPanning ? 'grabbing' : hoverHandle ? (hoverHandle.axis === 'h' ? 'ew-resize' : 'ns-resize') : 'default' }}
        >
          <g transform={`translate(${pan.x},${pan.y}) scale(${scale})`}>
            {shapes.map((shape, index) => {
              const isActive = anchor && anchor.shapeIndex === index
              const basePoly = shape.kind === 'rect' ? buildRectPolygonCentered(shape.a, shape.b, shape.width) : buildLPolygonCentered(shape.a, shape.b, shape.c, shape.width)
              const poly = isActive && previewInfo ? buildPreviewPolygon(previewInfo.shape) : basePoly
              return (
                <polygon
                  key={`poly-${index}`}
                  points={pointsToPolygon(poly)}
                  fill='rgba(59,130,246,0.15)'
                  stroke='#3b82f6'
                  strokeWidth={strokeW}
                  strokeLinejoin='round'
                />
              )
            })}
            {(!anchor || anchor.shapeIndex === undefined) && outlinePoints ? (
              <polygon
                points={outlinePoints}
                fill='rgba(59,130,246,0.10)'
                stroke='#3b82f6'
                strokeWidth={strokeW}
                strokeLinejoin='round'
              />
            ) : null}
            {shapes.map((shape, index) => {
              const isActive = anchor && anchor.shapeIndex === index && previewInfo
              const poly = isActive ? buildPreviewPolygon(previewInfo!.shape) : shape.kind === 'rect' ? buildRectPolygonCentered(shape.a, shape.b, shape.width) : buildLPolygonCentered(shape.a, shape.b, shape.c, shape.width)
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
                    key={`seglabel-${index}-${idx}`}
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
                        shapeIndex: index,
                        segmentIndex: seg.idx,
                        left: tx * scale + pan.x,
                        top: ty * scale + pan.y,
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
            {previewInfo ? (
              (() => {
                const previewPoly = buildPreviewPolygon(previewInfo.shape)
                const cx = previewPoly.reduce((s, p) => s + p.x, 0) / previewPoly.length
                const cy = previewPoly.reduce((s, p) => s + p.y, 0) / previewPoly.length
                const segs: { a: Point; b: Point }[] = []
                for (let i = 1; i < previewPoly.length; i++) segs.push({ a: previewPoly[i - 1], b: previewPoly[i] })
                segs.push({ a: previewPoly[previewPoly.length - 1], b: previewPoly[0] })
                return segs.map((seg, idx) => {
                  const midX = (seg.a.x + seg.b.x) / 2
                  const midY = (seg.a.y + seg.b.y) / 2
                  const length = Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y)
                  const dirToOutsideX = midX - cx
                  const dirToOutsideY = midY - cy
                  const dlen = Math.hypot(dirToOutsideX, dirToOutsideY) || 1
                  const off = (previewInfo.shape.kind === 'rect' ? previewInfo.shape.width : previewInfo.shape.width) + 12
                  const tx = midX + (dirToOutsideX / dlen) * (off / scale)
                  const ty = midY + (dirToOutsideY / dlen) * (off / scale)
                  return (
                    <text
                      key={`preview-live-${idx}`}
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
                })
              })()
            ) : null}
            {!previewInfo && previewSegments.map((seg, idx) => {
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
        <div className="absolute" style={{ left: editing.left, top: editing.top }}>
            <input
                value={editing.value}
                onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                onFocus={(e) => {
                    e.target.select()
                }}
                onBlur={() => {
                    const num = Number(editing.value)
                    if (!Number.isFinite(num)) { setEditing(null); return }
                    const si = editing.shapeIndex
                    const segIdx = editing.segmentIndex
                    const shape = shapes[si]
                    if (!shape) { setEditing(null); return }
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
                        const poly = [a, b, { x: b.x + nx * shape.width, y: b.y + ny * shape.width }, { x: a.x + nx * shape.width, y: a.y + ny * shape.width }]
                        const vdx = poly[(segIdx + 1) % 4].x - poly[segIdx].x
                        const vdy = poly[(segIdx + 1) % 4].y - poly[segIdx].y
                        const dotPrimary = Math.abs(vdx * ux + vdy * uy)
                        const dotNormal = Math.abs(vdx * nx + vdy * ny)
                        if (dotPrimary >= dotNormal) {
                            const sign = Math.sign((dx !== 0 ? dx : dy)) || 1
                            const newB = { x: a.x + ux * num * sign, y: a.y + uy * num * sign }
                            const next = { kind: 'rect', a, b: newB, width: shape.width }
                            const arr = shapes.slice()
                            arr[si] = next as RectShape
                            setShapes(arr)
                        } else {
                            const next = { kind: 'rect', a: shape.a, b: shape.b, width: num }
                            const arr = shapes.slice()
                            arr[si] = next as RectShape
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
                        const poly = [a, b, c, { x: c.x + snx * shape.width, y: c.y + sny * shape.width }, { x: b.x + snx * shape.width, y: b.y + sny * shape.width }, { x: b.x + pnx * shape.width, y: b.y + pny * shape.width }, { x: a.x + pnx * shape.width, y: a.y + pny * shape.width }]
                        const vdx = poly[(segIdx + 1) % poly.length].x - poly[segIdx].x
                        const vdy = poly[(segIdx + 1) % poly.length].y - poly[segIdx].y
                        const dPrimary = Math.abs(vdx * pux + vdy * puy)
                        const dSecondary = Math.abs(vdx * sux + vdy * suy)
                        const dWidth = Math.max(Math.abs(vdx * pnx + vdy * pny), Math.abs(vdx * snx + vdy * sny))
                        if (dPrimary >= dSecondary && dPrimary >= dWidth) {
                            const sign = Math.sign((pdx !== 0 ? pdx : pdy)) || 1
                            const newB = { x: a.x + pux * num * sign, y: a.y + puy * num * sign }
                            const next = { kind: 'l', a, b: newB, c: shape.c, width: shape.width }
                            const arr = shapes.slice()
                            arr[si] = next as LShape
                            setShapes(arr)
                        } else if (dSecondary >= dPrimary && dSecondary >= dWidth) {
                            const sign = Math.sign((sdx !== 0 ? sdx : sdy)) || 1
                            const newC = { x: b.x + sux * num * sign, y: b.y + suy * num * sign }
                            const next = { kind: 'l', a, b, c: newC, width: shape.width }
                            const arr = shapes.slice()
                            arr[si] = next as LShape
                            setShapes(arr)
                        } else {
                            const next = { kind: 'l', a: shape.a, b: shape.b, c: shape.c, width: num }
                            const arr = shapes.slice()
                            arr[si] = next as LShape
                            setShapes(arr)
                        }
                    }
                    setEditing(null)
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        const target = e.target
                        if (target && 'blur' in target && typeof target.blur === 'function') target.blur()
                    }
                    if (e.key === 'Escape') setEditing(null)
                }}
                className="border border-gray-300 rounded px-1 py-0.5 text-xs bg-white"
                style={{ width: 64 }}
                autoFocus
            />
        </div>
      ) : null}
        </div>
    )
}



