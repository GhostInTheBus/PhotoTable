import { useStore } from '../store/store'
import { useState } from 'react'

interface ToolbarProps {
  onExport: () => void
  onExportPDF: () => void
  onResetView: () => void
  onFitAll: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onBackupExport: () => void
  onBackupImport: () => void
  onUndo: () => void
  onRedo: () => void
  onAlign: (mode: 'left' | 'right' | 'top' | 'bottom' | 'center-x' | 'center-y') => void
  onDistribute: (axis: 'x' | 'y') => void
  onNormalizeScale: () => void
}

export function Toolbar({
  onExport,
  onExportPDF,
  onResetView,
  onFitAll,
  onZoomIn,
  onZoomOut,
  onBackupExport,
  onBackupImport,
  onUndo,
  onRedo,
  onAlign,
  onDistribute,
  onNormalizeScale,
}: ToolbarProps) {
  const [showHelp, setShowHelp] = useState(false)
  const photos = useStore((s) => s.canvas.photos)
  const zoom = useStore((s) => s.canvas.viewport.zoom)
  const selectedIds = useStore((s) => s.ui.selectedIds)
  const createClump = useStore((s) => s.createClump)
  const unclumpPhotos = useStore((s) => s.unclumpPhotos)
  const clearTable = useStore((s) => s.clearTable)
  const openModal = useStore((s) => s.openModal)
  const toggleFilenames = useStore((s) => s.toggleFilenames)
  const saveStatus = useStore((s) => s.ui.saveStatus)
  const saveError = useStore((s) => s.ui.saveError)
  const canUndo = useStore((s) => s.ui.undoStack.length > 0)
  const canRedo = useStore((s) => s.ui.redoStack.length > 0)

  const canClump = selectedIds.length >= 2
  const canAlign = selectedIds.length >= 2
  const canDistribute = selectedIds.length >= 3
  const canUnclump = selectedIds.some((id) => {
    const photo = photos.find((p) => p.id === id)
    return photo?.clumpId != null
  })
  const hasPhotos = photos.length > 0

  function handleClearTable() {
    openModal({
      type: 'confirm',
      title: 'Clear table?',
      message: 'This removes all placed photos from the current table. Folders and library images are not affected, and you can undo the clear.',
      confirmLabel: 'Clear',
      danger: true,
      onConfirm: clearTable,
    })
  }

  function handleClump() {
    if (selectedIds.length >= 2) createClump(selectedIds)
  }

  function handleUnclump() {
    unclumpPhotos(selectedIds)
  }

  const btnBase =
    'min-w-8 h-8 px-2 flex items-center justify-center text-xs text-gray-300 hover:text-orange-200 hover:bg-orange-500/10 rounded-md transition-all disabled:opacity-30 disabled:cursor-not-allowed'
  const sep = <div className="w-px h-4 bg-white/10 mx-0.5 shrink-0" />
  const saveLabel = saveStatus === 'saving' ? 'Saving' : saveStatus === 'error' ? 'Save error' : 'Saved'

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-1">
      <div
        className="flex items-center justify-center flex-wrap gap-0.5 px-2 py-1.5 rounded-lg max-w-[calc(100vw-260px)]"
        style={{
          background: 'rgba(12, 11, 10, 0.94)',
          backdropFilter: 'blur(14px)',
          border: '1px solid rgba(249,115,22,0.15)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.55)',
        }}
      >
        <button onClick={handleClearTable} disabled={!hasPhotos} className={btnBase} title="Clear table">
          Clear
        </button>
        {sep}
        <button onClick={handleClump} disabled={!canClump} className={btnBase} title="Clump selected">
          Clump
        </button>
        <button onClick={handleUnclump} disabled={!canUnclump} className={btnBase} title="Unclump selected">
          Split
        </button>
        <button onClick={onUndo} disabled={!canUndo} className={btnBase} title="Undo">
          Undo
        </button>
        <button onClick={onRedo} disabled={!canRedo} className={btnBase} title="Redo">
          Redo
        </button>
        {sep}
        <button onClick={() => onAlign('left')} disabled={!canAlign} className={btnBase} title="Align left">
          L
        </button>
        <button onClick={() => onAlign('top')} disabled={!canAlign} className={btnBase} title="Align top">
          T
        </button>
        <button onClick={() => onAlign('center-x')} disabled={!canAlign} className={btnBase} title="Align horizontal centers">
          CX
        </button>
        <button onClick={() => onAlign('center-y')} disabled={!canAlign} className={btnBase} title="Align vertical centers">
          CY
        </button>
        <button onClick={() => onDistribute('x')} disabled={!canDistribute} className={btnBase} title="Distribute horizontally">
          DX
        </button>
        <button onClick={() => onDistribute('y')} disabled={!canDistribute} className={btnBase} title="Distribute vertically">
          DY
        </button>
        <button onClick={onNormalizeScale} disabled={!canAlign} className={btnBase} title="Match selected photo sizes">
          Size
        </button>
        {sep}
        <button onClick={onZoomOut} className={btnBase} title="Zoom out">
          -
        </button>
        <div className="w-12 text-center text-xs text-gray-500 font-mono select-none">
          {Math.round(zoom * 100)}%
        </div>
        <button onClick={onZoomIn} className={btnBase} title="Zoom in">
          +
        </button>
        <button onClick={onFitAll} disabled={!hasPhotos} className={btnBase} title="Fit all photos">
          Fit
        </button>
        <button onClick={onResetView} className={btnBase} title="Reset view">
          1:1
        </button>
        {sep}
        <button onClick={toggleFilenames} className={btnBase} title="Toggle filenames">
          Names
        </button>
        <button onClick={onExport} disabled={!hasPhotos} className={btnBase} title="Export sequence as text file">
          TXT
        </button>
        <button onClick={onExportPDF} disabled={!hasPhotos} className={btnBase} title="Export layout as PDF">
          PDF
        </button>
        <button onClick={onBackupExport} disabled={!hasPhotos} className={btnBase} title="Export PhotoTable backup">
          Save
        </button>
        <button onClick={onBackupImport} className={btnBase} title="Import PhotoTable backup">
          Load
        </button>
        {sep}
        <div className="flex items-center gap-1.5 px-2 select-none" title={saveError ?? saveLabel}>
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              saveStatus === 'saving'
                ? 'bg-orange-400 animate-pulse'
                : saveStatus === 'error'
                  ? 'bg-red-500'
                  : 'bg-emerald-500/70'
            }`}
          />
          <span className={`text-xs ${saveStatus === 'error' ? 'text-red-300' : 'text-gray-600'}`}>
            {saveLabel}
          </span>
        </div>
        <button onClick={() => setShowHelp((v) => !v)} className={btnBase} title="Keyboard shortcuts">
          ?
        </button>
      </div>
      {(selectedIds.length > 0 || showHelp) && (
        <div
          className="flex items-center gap-3 px-3 py-1 rounded-md text-xs text-gray-400"
          style={{ background: 'rgba(12, 11, 10, 0.88)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {selectedIds.length > 0 && <span>{selectedIds.length} selected</span>}
          {showHelp && (
            <span className="font-mono text-gray-500">
              Space pan · Wheel zoom · F names · Delete remove · Ctrl+Z undo · Ctrl+Y redo
            </span>
          )}
        </div>
      )}
    </div>
  )
}
