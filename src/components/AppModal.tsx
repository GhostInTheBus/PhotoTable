import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/store'

export function AppModal() {
  const modal = useStore((s) => s.ui.modal)
  const closeModal = useStore((s) => s.closeModal)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!modal) return
    setBusy(false)
    setValue(modal.type === 'prompt' ? modal.initialValue : '')
    requestAnimationFrame(() => inputRef.current?.select())
  }, [modal])

  if (!modal) return null

  async function confirm() {
    if (!modal) return
    setBusy(true)
    try {
      if (modal.type === 'prompt') {
        const trimmed = value.trim()
        if (!trimmed) return
        await modal.onConfirm(trimmed)
      } else {
        await modal.onConfirm()
      }
      closeModal()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 px-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-lg p-4"
        style={{
          background: 'rgba(18,17,16,0.98)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
        }}
      >
        <div className="text-sm font-medium text-gray-200">{modal.title}</div>
        {modal.message && <div className="mt-2 text-sm text-gray-500 leading-relaxed">{modal.message}</div>}
        {modal.type === 'prompt' && (
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void confirm()
              if (e.key === 'Escape') closeModal()
            }}
            className="mt-3 w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 outline-none focus:border-orange-500/70"
          />
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={closeModal}
            disabled={busy}
            className="h-8 px-3 rounded-md text-sm text-gray-400 hover:bg-white/5 hover:text-gray-200 disabled:opacity-50"
          >
            {modal.cancelLabel ?? 'Cancel'}
          </button>
          <button
            onClick={() => void confirm()}
            disabled={busy || (modal.type === 'prompt' && value.trim().length === 0)}
            className={`h-8 px-3 rounded-md text-sm disabled:opacity-50 ${
              modal.type === 'confirm' && modal.danger
                ? 'bg-red-500/15 text-red-200 hover:bg-red-500/25'
                : 'bg-orange-500/15 text-orange-200 hover:bg-orange-500/25'
            }`}
          >
            {modal.confirmLabel ?? 'OK'}
          </button>
        </div>
      </div>
    </div>
  )
}
