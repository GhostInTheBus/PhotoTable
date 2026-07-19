import { useEffect, useMemo, useState } from 'react'
import { Folder, LibraryImage } from '../store/types'
import { useStore } from '../store/store'

interface FolderPanelProps {
  folder: Folder
  onRefresh: (folderId: string) => void
  onRemove?: (folderId: string) => void
  onAddAll?: (folderId: string) => void
  density?: 'small' | 'medium' | 'large'
}

export function FolderPanel({ folder, onRefresh, onRemove, onAddAll, density = 'medium' }: FolderPanelProps) {
  const photos = useStore((s) => s.canvas.photos)
  const [visibleCount, setVisibleCount] = useState(240)
  const gridCols = density === 'small' ? 'grid-cols-4' : density === 'large' ? 'grid-cols-2' : 'grid-cols-3'
  const visibleImages = useMemo(() => folder.images.slice(0, visibleCount), [folder.images, visibleCount])
  const hiddenCount = Math.max(0, folder.images.length - visibleImages.length)

  useEffect(() => {
    setVisibleCount(240)
  }, [folder.id, folder.images.length])

  function handleDragStart(e: React.DragEvent, img: LibraryImage) {
    e.dataTransfer.setData('application/x-library-image-id', img.id)
  }

  return (
    <div className="mb-2">
      <div className="flex items-center justify-between px-2 py-1 gap-1">
        <span className="text-gray-300 text-xs font-medium truncate flex-1">{folder.name}</span>
        <span className="text-gray-600 font-mono text-[10px]">{folder.images.length}</span>
        {onAddAll && (
          <button
            onClick={() => onAddAll(folder.id)}
            title="Add all images to canvas"
            className="shrink-0 px-2 py-0.5 text-xs text-gray-400 hover:text-orange-300 hover:bg-orange-500/10 rounded transition-all"
          >
            +All
          </button>
        )}
        <button
          onClick={() => onRefresh(folder.id)}
          title="Refresh folder"
          className="shrink-0 px-2 py-0.5 text-xs text-gray-500 hover:text-gray-200 hover:bg-white/8 rounded transition-all"
        >
          ↻
        </button>
        {onRemove && (
          <button
            onClick={() => onRemove(folder.id)}
            title="Remove folder from library"
            className="shrink-0 px-2 py-0.5 text-xs text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-all"
          >
            ×
          </button>
        )}
      </div>
      {!folder.loaded && (
        <p className="text-gray-600 font-mono text-xs px-2 pb-1">Loading...</p>
      )}
      <div className={`grid ${gridCols} gap-1 px-2`}>
        {visibleImages.map((img) => {
          const placed = photos.some((p) => p.libraryImageId === img.id)
          return (
            <div
              key={img.id}
              draggable
              onDragStart={(e) => handleDragStart(e, img)}
              title={img.filename}
              className={`cursor-grab relative rounded overflow-hidden ${placed ? 'opacity-50' : ''}`}
            >
              {img.thumbnailUrl ? (
                <img
                  src={img.thumbnailUrl}
                  alt={img.filename}
                  className="w-full aspect-square object-cover"
                  draggable={false}
                />
              ) : (
                <div className="w-full aspect-square bg-gray-800 border border-gray-700 flex items-center justify-center px-1">
                  <span className="text-[10px] text-gray-500 text-center leading-tight truncate w-full">
                    Missing
                  </span>
                </div>
              )}
              {placed && <div className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-orange-400" />}
            </div>
          )
        })}
      </div>
      {hiddenCount > 0 && (
        <div className="px-2 pt-1">
          <button
            onClick={() => setVisibleCount((count) => count + 240)}
            className="w-full py-1 text-xs text-gray-500 hover:text-orange-300 hover:bg-orange-500/10 rounded"
          >
            Show {Math.min(240, hiddenCount)} more
          </button>
        </div>
      )}
    </div>
  )
}
