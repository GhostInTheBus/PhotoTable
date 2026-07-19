import { useEffect, useRef, useCallback } from 'react'
import { useStore } from '../store/store'
import { PlacedPhoto } from '../store/types'
import { resumeAutoSave, suspendAutoSave } from '../store/persist'

const BASE_WIDTH = 240

interface PhotoCardProps {
  photo: PlacedPhoto
  thumbnailUrl: string
}

const CORNERS = [
  { corner: 'tl' as const, style: { top: -7,    left: -7  }, cursor: 'nwse-resize' },
  { corner: 'tr' as const, style: { top: -7,    right: -7 }, cursor: 'nesw-resize' },
  { corner: 'bl' as const, style: { bottom: -7, left: -7  }, cursor: 'nesw-resize' },
  { corner: 'br' as const, style: { bottom: -7, right: -7 }, cursor: 'nwse-resize' },
]

export function PhotoCard({ photo, thumbnailUrl }: PhotoCardProps) {
  const movePhoto = useStore((s) => s.movePhoto)
  const bringToFront = useStore((s) => s.bringToFront)
  const bringGroupToFront = useStore((s) => s.bringGroupToFront)
  const setSelectedIds = useStore((s) => s.setSelectedIds)
  const setDraggingIds = useStore((s) => s.setDraggingIds)
  const setPhotoRotation = useStore((s) => s.setPhotoRotation)
  const captureHistory = useStore((s) => s.captureHistory)
  const showFilenames = useStore((s) => s.ui.showFilenames)
  const selectedIds = useStore((s) => s.ui.selectedIds)
  const isSelected = selectedIds.includes(photo.id)
  const scale = useStore((s) => s.canvas.photos.find((p) => p.id === photo.id)?.scale ?? photo.scale)
  const clump = useStore((s) =>
    photo.clumpId ? s.canvas.clumps.find((c) => c.id === photo.clumpId) ?? null : null
  )
  const clumpCount = useStore((s) =>
    photo.clumpId ? s.canvas.photos.filter((p) => p.clumpId === photo.clumpId).length : 0
  )

  const mediaRef = useRef<HTMLElement | null>(null)
  const dragStart = useRef<{ sx: number; sy: number } | null>(null)
  const groupStartPositions = useRef<Map<string, { x: number; y: number }>>(new Map())
  const resizeStart = useRef<{
    scale: number; clientX: number; clientY: number
    corner: 'tl' | 'tr' | 'bl' | 'br'
    startX: number; startY: number; startW: number; startH: number
  } | null>(null)
  const pointerHasMoved = useRef(false)

  const filename = useStore((s) => {
    const all = s.library.folders.flatMap((f) => f.images)
    return all.find((img) => img.id === photo.libraryImageId)?.filename ?? ''
  })

  // Called from each corner handle's onPointerDown
  const handleCornerPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation()
    if (e.button !== 0) return
    const corner = (e.currentTarget as HTMLElement).dataset.corner as 'tl' | 'tr' | 'bl' | 'br'
    resizeStart.current = {
      scale,
      clientX: e.clientX,
      clientY: e.clientY,
      corner,
      startX: photo.x,
      startY: photo.y,
      startW: BASE_WIDTH * scale,
      startH: mediaRef.current?.offsetHeight ?? Math.round(BASE_WIDTH * scale * 0.67),
    }
    captureHistory()
    suspendAutoSave()
    // Capture on the corner element itself so move/up bubble back to the photo card
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [captureHistory, photo.x, photo.y, scale])

  const finishGesture = useCallback(() => {
    const hadActiveGesture = resizeStart.current != null || dragStart.current != null
    resizeStart.current = null
    dragStart.current = null
    setDraggingIds([])
    if (hadActiveGesture) void resumeAutoSave({ flush: true })
  }, [setDraggingIds])

  useEffect(() => {
    const stopStuckGesture = () => finishGesture()
    window.addEventListener('pointerup', stopStuckGesture)
    window.addEventListener('pointercancel', stopStuckGesture)
    window.addEventListener('blur', stopStuckGesture)
    return () => {
      window.removeEventListener('pointerup', stopStuckGesture)
      window.removeEventListener('pointercancel', stopStuckGesture)
      window.removeEventListener('blur', stopStuckGesture)
    }
  }, [finishGesture])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation()
    if (e.button !== 0) return
    pointerHasMoved.current = false

    if (e.shiftKey) {
      const ids = selectedIds.includes(photo.id)
        ? selectedIds.filter((id) => id !== photo.id)
        : [...selectedIds, photo.id]
      setSelectedIds(ids)
      return
    }

    let activeIds: string[]
    if (photo.clumpId) {
      const clumpMemberIds = useStore.getState().canvas.photos
        .filter((p) => p.clumpId === photo.clumpId)
        .map((p) => p.id)
      activeIds = clumpMemberIds
      setSelectedIds(clumpMemberIds)
    } else if (selectedIds.includes(photo.id)) {
      activeIds = selectedIds
    } else {
      activeIds = [photo.id]
      setSelectedIds([photo.id])
    }
    setDraggingIds(activeIds)
    captureHistory()
    suspendAutoSave()
    if (activeIds.length > 1) {
      bringGroupToFront(activeIds, false)
    } else {
      bringToFront(activeIds[0], false)
    }

    dragStart.current = { sx: e.clientX, sy: e.clientY }
    groupStartPositions.current = new Map(
      useStore.getState().canvas.photos
        .filter((p) => activeIds.includes(p.id))
        .map((p) => [p.id, { x: p.x, y: p.y }])
    )
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [bringGroupToFront, bringToFront, captureHistory, photo, selectedIds, setDraggingIds, setSelectedIds])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (e.buttons === 1) pointerHasMoved.current = true
    if (resizeStart.current) {
      if (e.buttons !== 1) {
        finishGesture()
        return
      }
      const vp = useStore.getState().canvas.viewport
      const dx = (e.clientX - resizeStart.current.clientX) / vp.zoom
      const dy = (e.clientY - resizeStart.current.clientY) / vp.zoom
      const { corner, startW, startH, startX, startY } = resizeStart.current

      // Flip sign so dragging "away from center" always enlarges
      const sdx = (corner === 'bl' || corner === 'tl') ? -dx : dx
      const sdy = (corner === 'tr' || corner === 'tl') ? -dy : dy
      const delta = Math.abs(sdx) >= Math.abs(sdy) ? sdx : sdy

      const newW = Math.max(BASE_WIDTH * 0.1, startW + delta)
      const newScale = newW / BASE_WIDTH

      // Keep the opposite corner anchored in canvas space
      let newX = startX
      let newY = startY
      if (corner === 'bl' || corner === 'tl') newX = startX - (newW - startW)
      if (corner === 'tr' || corner === 'tl') newY = startY - (newW - startW) * (startH / startW)

      if (mediaRef.current) mediaRef.current.style.width = `${newW}px`
      useStore.getState().setPhotoScale(photo.id, newScale, false)
      useStore.getState().movePhoto(photo.id, newX, newY, false)
      return
    }
    if (!dragStart.current) return
    const vp = useStore.getState().canvas.viewport
    const dxCanvas = (e.clientX - dragStart.current.sx) / vp.zoom
    const dyCanvas = (e.clientY - dragStart.current.sy) / vp.zoom
    const dragging = useStore.getState().ui.draggingIds
    dragging.forEach((id) => {
      const start = groupStartPositions.current.get(id)
      if (!start) return
      movePhoto(id, start.x + dxCanvas, start.y + dyCanvas, false)
    })
  }, [finishGesture, movePhoto, photo.id])

  const handlePointerUp = useCallback(() => {
    finishGesture()
  }, [finishGesture])

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (pointerHasMoved.current) return   // was a drag, not a true double-tap
    setPhotoRotation(photo.id, 0)
  }, [photo.id, setPhotoRotation])

  return (
    <div
      style={{
        position: 'absolute',
        left: photo.x,
        top: photo.y,
        transform: `rotate(${photo.rotation}deg)`,
        transformOrigin: 'center',
        zIndex: photo.zIndex,
        cursor: 'grab',
        userSelect: 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
    >
      {clump && (
        <div
          style={{
            position: 'absolute',
            inset: -8,
            border: `3px solid ${clump.color}`,
            borderRadius: 3,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      )}
      {clump && (
        <div
          style={{
            position: 'absolute',
            top: -20,
            left: 0,
            fontFamily: 'monospace',
            fontSize: 9,
            color: clump.color,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {clump.name}{clumpCount > 0 ? ` · ${clumpCount}` : ''}
        </div>
      )}
      {isSelected && (
        <div
          style={{
            position: 'absolute',
            inset: -3,
            border: '2px solid #f97316',
            borderRadius: 2,
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />
      )}
      {thumbnailUrl ? (
        <img
          ref={(el) => { mediaRef.current = el }}
          src={thumbnailUrl}
          alt={filename}
          style={{
            display: 'block',
            width: BASE_WIDTH * scale,
            height: 'auto',
            maxWidth: 'none',
            pointerEvents: 'none',
          }}
          draggable={false}
        />
      ) : (
        <div
          ref={(el) => { mediaRef.current = el }}
          style={{
            width: BASE_WIDTH * scale,
            height: Math.round(BASE_WIDTH * scale * 0.67),
            maxWidth: 'none',
            background: '#24211f',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#8b8178',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 12,
            pointerEvents: 'none',
            fontFamily: 'monospace',
            fontSize: 11,
            textAlign: 'center',
          }}
        >
          Missing source<br />Refresh or re-add folder
        </div>
      )}
      {isSelected && CORNERS.map(({ corner, style, cursor }) => (
        <div
          key={corner}
          data-corner={corner}
          onPointerDown={handleCornerPointerDown}
          title="Drag to resize"
          style={{
            position: 'absolute',
            width: 14,
            height: 14,
            background: '#f97316',
            border: '2px solid #fff',
            borderRadius: 3,
            cursor,
            zIndex: 10,
            ...style,
          }}
        />
      ))}
      {showFilenames && (
        <div
          style={{
            textAlign: 'center',
            fontFamily: 'monospace',
            fontSize: 10,
            color: '#aaa',
            marginTop: 4,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 240,
          }}
        >
          {filename}
        </div>
      )}
    </div>
  )
}
