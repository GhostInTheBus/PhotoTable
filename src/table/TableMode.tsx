import { useEffect, useRef, useState, useCallback } from 'react'
import { useStore } from '../store/store'
import { InfiniteCanvas } from './InfiniteCanvas'
import { PhotoCard } from './PhotoCard'
import { RubberBand } from './RubberBand'
import { Sidebar } from './Sidebar'
import { Toolbar } from './Toolbar'
import { Legend } from './Legend'
import { Inspector } from './Inspector'
import { getPhotoSize, isPhotoInRect } from '../lib/canvasMath'
import { exportSequenceAsText, downloadTextFile } from '../lib/export'
import { exportLayoutAsPDF } from '../lib/exportPDF'
import { createThumbnailFromBlob } from '../lib/imageLoader'
import { saveImportedImage } from '../lib/db'
import { exportActiveProjectBackup, importProjectBackup, pickBackupFile } from '../lib/backup'

interface RubberBandRect {
  startX: number; startY: number; endX: number; endY: number
}

export function TableMode() {
  const photos = useStore((s) => s.canvas.photos)
  const clumps = useStore((s) => s.canvas.clumps)
  const selectedIds = useStore((s) => s.ui.selectedIds)
  const setSelectedIds = useStore((s) => s.setSelectedIds)
  const setViewport = useStore((s) => s.setViewport)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const setSaveStatus = useStore((s) => s.setSaveStatus)
  const alignSelected = useStore((s) => s.alignSelected)
  const distributeSelected = useStore((s) => s.distributeSelected)
  const normalizeSelectedScale = useStore((s) => s.normalizeSelectedScale)
  const library = useStore((s) => s.library)

  const [rubberBand, setRubberBand] = useState<RubberBandRect | null>(null)
  const rubberStart = useRef<{ x: number; y: number } | null>(null)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const getContainerRect = () =>
    canvasContainerRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === 'KeyF') useStore.getState().toggleFilenames()
      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyZ' && !e.shiftKey) {
        e.preventDefault()
        useStore.getState().undo()
      }
      if ((e.metaKey || e.ctrlKey) && (e.code === 'KeyY' || (e.code === 'KeyZ' && e.shiftKey))) {
        e.preventDefault()
        useStore.getState().redo()
      }
      if ((e.code === 'Delete' || e.code === 'Backspace') && document.activeElement === document.body) {
        const ids = useStore.getState().ui.selectedIds
        useStore.getState().removePhotos(ids)
        setSelectedIds([])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setSelectedIds])

  const thumbnailMap = new Map(
    library.folders.flatMap((f) => f.images.map((img) => [img.id, img.thumbnailUrl]))
  )
  const libraryImages = library.folders.flatMap((f) => f.images)
  const selectedClumpBounds = clumps.flatMap((clump) => {
    const members = photos.filter((p) => p.clumpId === clump.id)
    if (members.length < 2 || !members.some((p) => selectedIds.includes(p.id))) return []
    const minX = Math.min(...members.map((p) => p.x))
    const minY = Math.min(...members.map((p) => p.y))
    const maxX = Math.max(...members.map((p) => p.x + getPhotoSize(p, libraryImages).width))
    const maxY = Math.max(...members.map((p) => p.y + getPhotoSize(p, libraryImages).height))
    return [{ clump, x: minX, y: minY, width: maxX - minX, height: maxY - minY, count: members.length }]
  })

  const handleFinderDrop = useCallback(async (e: DragEvent) => {
    if (!e.dataTransfer) return
    e.preventDefault()

    // Collect all JPEG files, including those inside dropped folders
    const imageFiles: File[] = []
    const IMAGE_RE = /\.(jpe?g|png|gif|webp)$/i

    async function collectFromEntry(entry: FileSystemEntry): Promise<void> {
      if (entry.isFile) {
        if (IMAGE_RE.test(entry.name)) {
          await new Promise<void>((res) => {
            (entry as FileSystemFileEntry).file((f) => { imageFiles.push(f); res() })
          })
        }
      } else if (entry.isDirectory) {
        const reader = (entry as FileSystemDirectoryEntry).createReader()
        await new Promise<void>((res) => {
          reader.readEntries(async (entries) => {
            await Promise.all(entries.map(collectFromEntry))
            res()
          })
        })
      }
    }

    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      const entries = Array.from(e.dataTransfer.items)
        .map((item) => item.webkitGetAsEntry())
        .filter((entry): entry is FileSystemEntry => entry !== null)
      await Promise.all(entries.map(collectFromEntry))
    } else {
      // Fallback for browsers without webkitGetAsEntry
      Array.from(e.dataTransfer.files)
        .filter((f) => IMAGE_RE.test(f.name))
        .forEach((f) => imageFiles.push(f))
    }

    if (imageFiles.length === 0) return

    const vp = useStore.getState().canvas.viewport
    const cr = canvasContainerRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 }
    const maxZ = Math.max(0, ...useStore.getState().canvas.photos.map((p) => p.zIndex))

    const FINDER_FOLDER_ID = 'finder-drop'
    const existingFolder = useStore.getState().library.folders.find((f) => f.id === FINDER_FOLDER_ID)

    // Generate thumbnails for dropped files
    const newImages = await Promise.all(
      imageFiles.map(async (file) => {
        const id = `finder-${file.name}-${file.size}-${file.lastModified}`
        const thumbnail = await createThumbnailFromBlob(file)
        await saveImportedImage({ id, filename: file.name, folderPath: 'Finder Drop', blob: file })
        return {
          id,
          filename: file.name,
          folderPath: 'Finder Drop',
          fileHandle: null,
          thumbnailUrl: thumbnail.url,
          source: 'imported-blob' as const,
          width: thumbnail.width,
          height: thumbnail.height,
        }
      })
    )

    // Merge into existing or new "Finder Drop" folder
    const existingImages = existingFolder?.images ?? []
    const mergedImages = [
      ...existingImages,
      ...newImages.filter((ni) => !existingImages.some((ei) => ei.id === ni.id)),
    ]

    if (!existingFolder) {
      useStore.getState().addFolder({
        id: FINDER_FOLDER_ID,
        name: 'Finder Drop',
        handle: null,
        images: mergedImages,
        loaded: true,
      })
    } else {
      useStore.getState().setFolderImages(FINDER_FOLDER_ID, mergedImages)
    }

    // Place photos at drop position in a grid
    const dropX = (e.clientX - cr.left - vp.x) / vp.zoom
    const dropY = (e.clientY - cr.top  - vp.y) / vp.zoom
    const SPACING = 260
    const COLS = Math.max(1, Math.ceil(Math.sqrt(imageFiles.length)))

    newImages.forEach((img, i) => {
      const col = i % COLS
      const row = Math.floor(i / COLS)
      useStore.getState().addPhoto({
        id: `placed-${img.id}-${Date.now()}-${i}`,
        libraryImageId: img.id,
        filenameHint: img.filename,
        x: dropX + col * SPACING,
        y: dropY + row * SPACING,
        rotation: 0,
        scale: 1,
        zIndex: maxZ + i + 1,
        clumpId: null,
      })
    })
  }, [])

  useEffect(() => {
    const container = document.querySelector('[data-table-drop]') as HTMLElement | null
    if (!container) return
    const onDragOver = (e: DragEvent) => { e.preventDefault() }
    container.addEventListener('dragover', onDragOver)
    container.addEventListener('drop', handleFinderDrop as unknown as EventListener)
    return () => {
      container.removeEventListener('dragover', onDragOver)
      container.removeEventListener('drop', handleFinderDrop as unknown as EventListener)
    }
  }, [handleFinderDrop])

  const handleSidebarDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const imageId = e.dataTransfer.getData('application/x-library-image-id')
    if (!imageId) return

    const vp = useStore.getState().canvas.viewport
    const cr = canvasContainerRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 }
    const x = (e.clientX - cr.left - vp.x) / vp.zoom
    const y = (e.clientY - cr.top  - vp.y) / vp.zoom
    const maxZ = Math.max(0, ...useStore.getState().canvas.photos.map((p) => p.zIndex))
    const image = useStore.getState().library.folders
      .flatMap((f) => f.images)
      .find((img) => img.id === imageId)

    useStore.getState().addPhoto({
      id: `placed-${imageId}-${Date.now()}`,
      libraryImageId: imageId,
      filenameHint: image?.filename,
      x,
      y,
      rotation: 0,
      scale: 1,
      zIndex: maxZ + 1,
      clumpId: null,
    })
  }, [])

  const handleBackgroundPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    setSelectedIds([])
    rubberStart.current = { x: e.clientX, y: e.clientY }
    setRubberBand({ startX: e.clientX, startY: e.clientY, endX: e.clientX, endY: e.clientY })
  }, [setSelectedIds])

  useEffect(() => {
    // Shared helper: compute canvas-space rect from current rubber band extents
    // and immediately update the selection to all photos whose centre falls inside.
    function applySelection(endX: number, endY: number) {
      if (!rubberStart.current) return
      const vp = useStore.getState().canvas.viewport
      const cr = getContainerRect()
      const screenX = Math.min(rubberStart.current.x, endX)
      const screenY = Math.min(rubberStart.current.y, endY)
      const rb = {
        x: (screenX - cr.left - vp.x) / vp.zoom,
        y: (screenY - cr.top  - vp.y) / vp.zoom,
        width: Math.abs(endX - rubberStart.current.x) / vp.zoom,
        height: Math.abs(endY - rubberStart.current.y) / vp.zoom,
      }
      const allPhotos = useStore.getState().canvas.photos
      const selected = allPhotos.filter((p) => isPhotoInRect(p, rb))
      setSelectedIds(selected.map((p) => p.id))
    }

    function onMove(e: PointerEvent) {
      if (!rubberStart.current) return
      setRubberBand({
        startX: rubberStart.current.x,
        startY: rubberStart.current.y,
        endX: e.clientX,
        endY: e.clientY,
      })
      applySelection(e.clientX, e.clientY)
    }
    function onUp(e: PointerEvent) {
      if (!rubberStart.current) return
      applySelection(e.clientX, e.clientY)
      rubberStart.current = null
      setRubberBand(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [setSelectedIds])

  function handleExport() {
    const { photos, clumps } = useStore.getState().canvas
    const images = useStore.getState().library.folders.flatMap((f) => f.images)
    const content = exportSequenceAsText(photos, clumps, images)
    const date = new Date().toISOString().slice(0, 10)
    downloadTextFile(content, `sequence-${date}.txt`)
  }

  async function handleExportPDF() {
    const { photos } = useStore.getState().canvas
    const images = useStore.getState().library.folders.flatMap((f) => f.images)
    const showFilenames = useStore.getState().ui.showFilenames
    try {
      await exportLayoutAsPDF(photos, images, showFilenames)
    } catch (err) {
      setSaveStatus('error', err instanceof Error ? err.message : 'PDF export failed')
    }
  }

  async function handleBackupImport() {
    const file = await pickBackupFile()
    if (!file) return
    try {
      await importProjectBackup(file)
      setSaveStatus('saving')
    } catch (err) {
      setSaveStatus('error', err instanceof Error ? err.message : 'Backup import failed')
    }
  }

  function handleResetView() {
    setViewport({ x: 0, y: 0, zoom: 1 })
  }

  function handleZoom(delta: number) {
    const rect = canvasContainerRef.current?.getBoundingClientRect()
    if (!rect) return
    const current = useStore.getState().canvas.viewport
    const nextZoom = Math.min(4, Math.max(0.05, current.zoom * delta))
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const worldX = (centerX - current.x) / current.zoom
    const worldY = (centerY - current.y) / current.zoom
    setViewport({
      x: centerX - worldX * nextZoom,
      y: centerY - worldY * nextZoom,
      zoom: nextZoom,
    })
  }

  function handleFitAll() {
    const rect = canvasContainerRef.current?.getBoundingClientRect()
    if (!rect || photos.length === 0) return
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    photos.forEach((photo) => {
      const { width: w, height: h } = getPhotoSize(photo, libraryImages)
      minX = Math.min(minX, photo.x)
      minY = Math.min(minY, photo.y)
      maxX = Math.max(maxX, photo.x + w)
      maxY = Math.max(maxY, photo.y + h)
    })
    const padding = 80
    const contentW = Math.max(1, maxX - minX)
    const contentH = Math.max(1, maxY - minY)
    const zoom = Math.min(2, Math.max(0.05, Math.min(
      (rect.width - padding) / contentW,
      (rect.height - padding) / contentH
    )))
    setViewport({
      x: rect.width / 2 - (minX + contentW / 2) * zoom,
      y: rect.height / 2 - (minY + contentH / 2) * zoom,
      zoom,
    })
  }

  return (
    <div className="w-full h-full flex" data-table-drop="">
      <Sidebar />
      <div className="flex-1 relative" onDragOver={(e) => e.preventDefault()} onDrop={handleSidebarDrop}>
        <Toolbar
          onExport={handleExport}
          onExportPDF={handleExportPDF}
          onResetView={handleResetView}
          onFitAll={handleFitAll}
          onZoomIn={() => handleZoom(1.2)}
          onZoomOut={() => handleZoom(1 / 1.2)}
          onBackupExport={() => void exportActiveProjectBackup()}
          onBackupImport={() => void handleBackupImport()}
          onUndo={undo}
          onRedo={redo}
          onAlign={alignSelected}
          onDistribute={distributeSelected}
          onNormalizeScale={normalizeSelectedScale}
        />
        <InfiniteCanvas containerRef={canvasContainerRef} onBackgroundPointerDown={handleBackgroundPointerDown}>
          {selectedClumpBounds.map(({ clump, x, y, width, height, count }) => (
            <div
              key={clump.id}
              style={{
                position: 'absolute',
                left: x - 18,
                top: y - 28,
                width: width + 36,
                height: height + 46,
                border: `1px dashed ${clump.color}`,
                background: `${clump.color}12`,
                pointerEvents: 'none',
                zIndex: 0,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: -18,
                  left: 0,
                  color: clump.color,
                  fontFamily: 'monospace',
                  fontSize: 10,
                  whiteSpace: 'nowrap',
                }}
              >
                {clump.name} · {count}
              </div>
            </div>
          ))}
          {photos.map((photo) => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              thumbnailUrl={thumbnailMap.get(photo.libraryImageId) ?? ''}
            />
          ))}
        </InfiniteCanvas>
        <RubberBand rect={rubberBand} />
        <Inspector />
        <Legend />
      </div>
    </div>
  )
}
