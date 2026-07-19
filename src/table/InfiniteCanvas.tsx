import { useRef, useCallback, useEffect } from 'react'
import { useStore } from '../store/store'
import { applyZoomAtPoint } from '../lib/canvasMath'

const MIN_ZOOM = 0.05
const MAX_ZOOM = 4

interface InfiniteCanvasProps {
  children: React.ReactNode
  onBackgroundPointerDown?: (e: React.PointerEvent) => void
  containerRef?: React.RefObject<HTMLDivElement>
}

export function InfiniteCanvas({ children, onBackgroundPointerDown, containerRef }: InfiniteCanvasProps) {
  const viewport = useStore((s) => s.canvas.viewport)
  const setViewport = useStore((s) => s.setViewport)

  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })
  const vpAtPanStart = useRef({ x: 0, y: 0, zoom: 1 })
  const isSpaceDown = useRef(false)
  const pointerHasMoved = useRef(false)
  const activePointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchStart = useRef<{
    distance: number
    midpoint: { x: number; y: number }
    viewport: { x: number; y: number; zoom: number }
  } | null>(null)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const tag = (e.target as HTMLElement).tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return
        e.preventDefault()
        isSpaceDown.current = true
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') isSpaceDown.current = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (e.pointerType === 'touch' && activePointers.current.size === 2) {
      e.preventDefault()
      const points = [...activePointers.current.values()]
      const dx = points[1].x - points[0].x
      const dy = points[1].y - points[0].y
      pinchStart.current = {
        distance: Math.max(1, Math.hypot(dx, dy)),
        midpoint: { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 },
        viewport: { ...viewport },
      }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      return
    }
    pointerHasMoved.current = false
    const isMiddle = e.button === 1
    const isSpaceDrag = isSpaceDown.current && e.button === 0
    if (isMiddle || isSpaceDrag) {
      e.preventDefault()
      isPanning.current = true
      panStart.current = { x: e.clientX, y: e.clientY }
      vpAtPanStart.current = { ...viewport }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    } else if (e.button === 0 && onBackgroundPointerDown) {
      onBackgroundPointerDown(e)
    }
  }, [viewport, onBackgroundPointerDown])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (activePointers.current.has(e.pointerId)) {
      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    }
    if (pinchStart.current && activePointers.current.size >= 2) {
      e.preventDefault()
      pointerHasMoved.current = true
      const rect = e.currentTarget.getBoundingClientRect()
      const points = [...activePointers.current.values()].slice(0, 2)
      const dx = points[1].x - points[0].x
      const dy = points[1].y - points[0].y
      const midpoint = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 }
      const start = pinchStart.current
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, start.viewport.zoom * (Math.hypot(dx, dy) / start.distance)))
      const startLocalX = start.midpoint.x - rect.left
      const startLocalY = start.midpoint.y - rect.top
      const worldX = (startLocalX - start.viewport.x) / start.viewport.zoom
      const worldY = (startLocalY - start.viewport.y) / start.viewport.zoom
      setViewport({
        x: midpoint.x - rect.left - worldX * newZoom,
        y: midpoint.y - rect.top - worldY * newZoom,
        zoom: newZoom,
      })
      return
    }
    if (e.buttons === 1) pointerHasMoved.current = true
    if (!isPanning.current) return
    const dx = e.clientX - panStart.current.x
    const dy = e.clientY - panStart.current.y
    setViewport({
      ...vpAtPanStart.current,
      x: vpAtPanStart.current.x + dx,
      y: vpAtPanStart.current.y + dy,
    })
  }, [setViewport])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    activePointers.current.delete(e.pointerId)
    if (activePointers.current.size < 2) pinchStart.current = null
    isPanning.current = false
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const localX = e.clientX - rect.left
    const localY = e.clientY - rect.top
    const delta = e.deltaY < 0 ? 1.1 : 0.9
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, viewport.zoom * delta))
    setViewport(applyZoomAtPoint(viewport, newZoom, localX, localY))
  }, [viewport, setViewport])

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).dataset.background !== 'true') return
    if (pointerHasMoved.current) return   // was a drag, not a true double-tap
    setViewport({ x: 0, y: 0, zoom: 1 })
  }, [setViewport])

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden relative select-none"
      style={{ background: '#181614', touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
      data-background="true"
    >
      {/* Grid dots for visual reference */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.11) 1px, transparent 1px)',
          backgroundSize: `${40 * viewport.zoom}px ${40 * viewport.zoom}px`,
          backgroundPosition: `${viewport.x}px ${viewport.y}px`,
        }}
      />
      {/* Canvas transform container */}
      <div
        style={{
          position: 'absolute',
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {children}
      </div>
    </div>
  )
}
