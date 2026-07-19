import { useStore } from './store'
import { saveCanvasState } from '../lib/db'

let saveTimer: ReturnType<typeof setTimeout> | null = null
let suspendCount = 0
let dirtyWhileSuspended = false

function canvasSnapshot() {
  const canvas = useStore.getState().canvas
  return {
    photos: canvas.photos,
    clumps: canvas.clumps,
    clumpCounter: canvas.clumpCounter,
    viewport: canvas.viewport,
  }
}

async function saveCurrentCanvas(projectId: string): Promise<void> {
  await saveCanvasState(canvasSnapshot(), projectId)
  useStore.getState().setSaveStatus('saved')
}

export function initAutoSave(): () => void {
  const unsub = useStore.subscribe(
    (state) => state.canvas,
    (canvas) => {
      const projectId = useStore.getState().projects.activeProjectId
      if (!projectId) return
      if (suspendCount > 0) {
        dirtyWhileSuspended = true
        return
      }
      if (saveTimer) clearTimeout(saveTimer)
      useStore.getState().setSaveStatus('saving')
      saveTimer = setTimeout(async () => {
        try {
          await saveCanvasState({
            photos: canvas.photos,
            clumps: canvas.clumps,
            clumpCounter: canvas.clumpCounter,
            viewport: canvas.viewport,
          }, projectId)
          if (useStore.getState().projects.activeProjectId === projectId) {
            useStore.getState().setSaveStatus('saved')
          }
        } catch (err) {
          console.error('Auto-save failed:', err)
          useStore.getState().setSaveStatus('error', err instanceof Error ? err.message : 'Auto-save failed')
        }
      }, 500)
    }
  )
  return unsub
}

/** Flush any pending save immediately for the given project ID */
export async function flushSave(projectId: string): Promise<void> {
  if (!projectId) return
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  try {
    await saveCurrentCanvas(projectId)
  } catch (err) {
    useStore.getState().setSaveStatus('error', err instanceof Error ? err.message : 'Save failed')
    throw err
  }
}

export function suspendAutoSave(): void {
  suspendCount += 1
}

export async function resumeAutoSave(options: { flush?: boolean } = {}): Promise<void> {
  suspendCount = Math.max(0, suspendCount - 1)
  if (suspendCount > 0) return
  if (!dirtyWhileSuspended && !options.flush) return
  dirtyWhileSuspended = false
  const projectId = useStore.getState().projects.activeProjectId
  if (!projectId) return
  useStore.getState().setSaveStatus('saving')
  await flushSave(projectId)
}
