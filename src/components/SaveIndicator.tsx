import { useStore } from '../store/store'

export function SaveIndicator() {
  const status = useStore((s) => s.ui.saveStatus)
  const error = useStore((s) => s.ui.saveError)
  const color = status === 'saving' ? 'text-yellow-400' : status === 'error' ? 'text-red-500' : 'text-green-500'
  const label = status === 'saving' ? 'Saving...' : status === 'error' ? 'Save error' : 'Saved'
  return (
    <div className="fixed bottom-3 right-3 z-50 font-mono text-xs text-gray-400 flex items-center gap-1" title={error ?? label}>
      <span className={color}>●</span>
      {label}
    </div>
  )
}
