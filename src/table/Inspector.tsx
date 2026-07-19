import { useStore } from '../store/store'

export function Inspector() {
  const selectedIds = useStore((s) => s.ui.selectedIds)
  const photos = useStore((s) => s.canvas.photos)
  const folders = useStore((s) => s.library.folders)
  const relinkMissingPhotos = useStore((s) => s.relinkMissingPhotos)

  const images = folders.flatMap((folder) => folder.images)
  const imageMap = new Map(images.map((img) => [img.id, img]))
  const selected = photos.filter((photo) => selectedIds.includes(photo.id))
  const missing = photos.filter((photo) => !imageMap.has(photo.libraryImageId))
  const missingCount = missing.length

  if (selected.length === 0 && missingCount === 0) return null

  const first = selected[0]
  const firstImage = first ? imageMap.get(first.libraryImageId) : null

  return (
    <div
      className="fixed right-4 top-20 z-40 w-56 rounded-lg p-3 text-xs"
      style={{
        background: 'rgba(12,11,10,0.92)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.45)',
      }}
    >
      <div className="text-gray-500 uppercase tracking-wider font-medium mb-2">Inspector</div>
      {selected.length > 0 && (
        <div className="space-y-1 text-gray-400">
          <div className="flex justify-between gap-3"><span>Selected</span><span className="font-mono">{selected.length}</span></div>
          {selected.length === 1 && first && (
            <>
              <div className="truncate" title={firstImage?.filename ?? first.filenameHint ?? first.libraryImageId}>
                {firstImage?.filename ?? first.filenameHint ?? 'Missing source'}
              </div>
              <div className="flex justify-between gap-3"><span>Scale</span><span className="font-mono">{first.scale.toFixed(2)}</span></div>
              <div className="flex justify-between gap-3"><span>Rotation</span><span className="font-mono">{Math.round(first.rotation)}°</span></div>
              <div className="flex justify-between gap-3"><span>Z</span><span className="font-mono">{first.zIndex}</span></div>
            </>
          )}
        </div>
      )}
      {missingCount > 0 && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span>Missing sources</span>
            <span className="font-mono">{missingCount}</span>
          </div>
          <div className="max-h-24 overflow-y-auto mb-2 space-y-1">
            {missing.slice(0, 6).map((photo) => (
              <div key={photo.id} className="truncate text-[11px] text-gray-600" title={photo.filenameHint ?? photo.libraryImageId}>
                {photo.filenameHint ?? photo.libraryImageId}
              </div>
            ))}
            {missing.length > 6 && (
              <div className="text-[11px] text-gray-700">+{missing.length - 6} more</div>
            )}
          </div>
          <button
            onClick={relinkMissingPhotos}
            className="w-full h-8 rounded-md bg-orange-500/10 text-orange-200 hover:bg-orange-500/20"
          >
            Relink by filename
          </button>
        </div>
      )}
    </div>
  )
}
