interface RubberBandRect {
  startX: number
  startY: number
  endX: number
  endY: number
}

interface RubberBandProps {
  rect: RubberBandRect | null
}

export function RubberBand({ rect }: RubberBandProps) {
  if (!rect) return null
  const left = Math.min(rect.startX, rect.endX)
  const top = Math.min(rect.startY, rect.endY)
  const width = Math.abs(rect.endX - rect.startX)
  const height = Math.abs(rect.endY - rect.startY)

  return (
    <div
      style={{
        position: 'fixed',
        left,
        top,
        width,
        height,
        border: '1.5px solid #f97316',
        background: 'rgba(249, 115, 22, 0.08)',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    />
  )
}
