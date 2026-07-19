import { useEffect } from 'react'
import { useStore } from './store/store'
import { initAutoSave } from './store/persist'
import { TableMode } from './table/TableMode'
import { AppModal } from './components/AppModal'
import { revokeAllObjectUrls } from './lib/objectUrls'
import { restoreSession } from './lib/restoreSession'
import { hasSeenBackupNudge, markBackupNudgeSeen } from './lib/preferences'

export default function App() {
  useEffect(() => {
    const unsubAutoSave = initAutoSave()

    async function boot() {
      const result = await restoreSession()
      if (result.warnings.length > 0) {
        useStore.getState().openModal({
          type: 'confirm',
          title: 'Some sources need attention',
          message: result.warnings.slice(0, 4).join(' '),
          confirmLabel: 'OK',
          onConfirm: () => undefined,
        })
      } else if (!hasSeenBackupNudge()) {
        markBackupNudgeSeen()
        useStore.getState().openModal({
          type: 'confirm',
          title: 'Keep backups of important tables',
          message: 'PhotoTable saves locally in this browser. Use Save in the toolbar or Export in Project Manager to create a portable project backup for important work.',
          confirmLabel: 'Got it',
          cancelLabel: 'Later',
          onConfirm: () => undefined,
        })
      }
    }

    void boot().catch((err) => {
      useStore.getState().openModal({
        type: 'confirm',
        title: 'PhotoTable could not restore',
        message: err instanceof Error ? err.message : 'Startup restore failed.',
        confirmLabel: 'OK',
        onConfirm: () => undefined,
      })
    })
    return () => {
      unsubAutoSave()
      revokeAllObjectUrls()
    }
  }, [])

  return (
    <div className="w-full h-full relative">
      <TableMode />
      <AppModal />
    </div>
  )
}
