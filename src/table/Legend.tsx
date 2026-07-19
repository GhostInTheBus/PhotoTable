import { useState, useEffect } from 'react'
import { useStore } from '../store/store'
import { dismissLegend, isLegendDismissed } from '../lib/preferences'

const entries = [
  { input: 'Space + drag', action: 'Pan canvas' },
  { input: 'Scroll wheel', action: 'Zoom' },
  { input: 'Double-click empty', action: 'Fit view' },
  { input: 'Shift + click', action: 'Add to selection' },
  { input: 'Drag empty area', action: 'Rubber-band select' },
  { input: 'Double-click photo', action: 'Reset rotation' },
  { input: 'F', action: 'Toggle filenames' },
  { input: 'Delete / Backspace', action: 'Remove selected' },
  { input: 'Select 2+ → Clump', action: 'Group photos' },
  { input: 'Export', action: 'Save sequence as text' },
]

const kbdStyle: React.CSSProperties = {
  display: 'inline-block',
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 4,
  padding: '1px 6px',
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  fontSize: '0.68rem',
  color: '#d1d5db',
  lineHeight: 1.5,
  whiteSpace: 'nowrap',
}

export function Legend() {
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)
  const clumps = useStore((s) => s.canvas.clumps)
  const photos = useStore((s) => s.canvas.photos)
  const renameClump = useStore((s) => s.renameClump)
  const openModal = useStore((s) => s.openModal)

  useEffect(() => {
    if (!isLegendDismissed()) setVisible(true)
    setMounted(true)
  }, [])

  function dismiss() {
    dismissLegend()
    setVisible(false)
  }

  function handleRenameClump(id: string, currentName: string) {
    openModal({
      type: 'prompt',
      title: 'Rename clump',
      initialValue: currentName,
      confirmLabel: 'Rename',
      onConfirm: (next) => renameClump(id, next),
    })
  }

  if (!mounted) return null

  return (
    <>
      {/* ? toggle — bottom-right when legend is closed */}
      {!visible && (
        <button
          onClick={() => setVisible(true)}
          className="fixed bottom-4 right-4 z-50 w-7 h-7 rounded-full flex items-center justify-center text-xs text-gray-500 hover:text-gray-300 transition-colors"
          style={{ background: 'rgba(12,11,10,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}
          title="Show controls"
        >
          ?
        </button>
      )}

      {/* Legend panel */}
      {visible && (
        <div
          className="fixed bottom-4 right-4 z-50 rounded-xl p-3.5 w-72"
          style={{
            background: 'rgba(12,11,10,0.93)',
            backdropFilter: 'blur(14px)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Controls</span>
            <button
              onClick={dismiss}
              className="text-gray-600 hover:text-gray-300 transition-colors text-base leading-none"
              title="Dismiss"
            >
              ×
            </button>
          </div>
          <table className="w-full border-collapse">
            <tbody>
              {entries.map(({ input, action }) => (
                <tr key={input} className="align-middle">
                  <td className="pb-1.5 pr-3">
                    <code style={kbdStyle}>{input}</code>
                  </td>
                  <td className="pb-1.5 text-xs text-gray-500">{action}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {clumps.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/10">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Clumps</div>
              <div className="space-y-1">
                {clumps.map((clump) => {
                  const count = photos.filter((p) => p.clumpId === clump.id).length
                  return (
                    <button
                      key={clump.id}
                      onClick={() => handleRenameClump(clump.id, clump.name)}
                      className="w-full flex items-center gap-2 text-left px-1 py-0.5 rounded hover:bg-white/5"
                      title="Rename clump"
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: clump.color }} />
                      <span className="text-xs text-gray-400 truncate flex-1">{clump.name}</span>
                      <span className="text-[10px] text-gray-600 font-mono">{count}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
