import { deleteProjectRecord, loadCanvasState, saveCanvasState, saveProject } from '../lib/db'
import { exportActiveProjectBackup } from '../lib/backup'
import { useStore } from '../store/store'
import { Clump, PlacedPhoto, Project, Viewport } from '../store/types'

interface ProjectManagerProps {
  onClose: () => void
  onSwitchProject: (projectId: string) => Promise<void>
}

function cloneCanvas(canvas: {
  photos: PlacedPhoto[]
  clumps: Clump[]
  clumpCounter: number
  viewport: Viewport
}) {
  return {
    photos: canvas.photos.map((p) => ({ ...p, id: `placed-${crypto.randomUUID()}` })),
    clumps: canvas.clumps.map((c) => ({ ...c, id: `clump-${crypto.randomUUID()}` })),
    clumpCounter: canvas.clumpCounter,
    viewport: { ...canvas.viewport },
  }
}

export function ProjectManager({ onClose, onSwitchProject }: ProjectManagerProps) {
  const projects = useStore((s) => s.projects.projects)
  const activeProjectId = useStore((s) => s.projects.activeProjectId)
  const updateProjectName = useStore((s) => s.updateProjectName)
  const removeProject = useStore((s) => s.removeProject)
  const duplicateProject = useStore((s) => s.duplicateProject)
  const openModal = useStore((s) => s.openModal)

  async function rename(project: Project) {
    openModal({
      type: 'prompt',
      title: 'Rename project',
      initialValue: project.name,
      confirmLabel: 'Rename',
      onConfirm: async (name) => {
        await saveProject({ ...project, name })
        updateProjectName(project.id, name)
      },
    })
  }

  async function duplicate(project: Project) {
    const source = await loadCanvasState(project.id)
    const canvas = cloneCanvas({
      photos: (source?.photos ?? []) as PlacedPhoto[],
      clumps: (source?.clumps ?? []) as Clump[],
      clumpCounter: source?.clumpCounter ?? 0,
      viewport: (source?.viewport ?? { x: 0, y: 0, zoom: 1 }) as Viewport,
    })
    const copy: Project = {
      id: `proj-${crypto.randomUUID()}`,
      name: `${project.name} Copy`,
      createdAt: Date.now(),
    }
    await saveProject(copy)
    await saveCanvasState(canvas, copy.id)
    duplicateProject(copy, canvas)
  }

  function deleteProject(project: Project) {
    if (projects.length <= 1) return
    openModal({
      type: 'confirm',
      title: `Delete "${project.name}"?`,
      message: 'This removes the project and its saved canvas from this browser. This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        if (project.id === activeProjectId) {
          const other = projects.find((p) => p.id !== project.id)
          if (other) await onSwitchProject(other.id)
        }
        await deleteProjectRecord(project.id)
        removeProject(project.id)
      },
    })
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/45 flex items-start justify-center px-4 pt-16">
      <div
        className="w-full max-w-2xl rounded-lg p-4"
        style={{
          background: 'rgba(14,13,12,0.98)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm text-gray-200 font-medium">Project Manager</div>
            <div className="text-xs text-gray-600 mt-0.5">{projects.length} projects in this browser</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md text-gray-500 hover:text-gray-200 hover:bg-white/5">x</button>
        </div>
        <div className="space-y-1">
          {projects.map((project) => (
            <div
              key={project.id}
              className={`grid grid-cols-[1fr_auto] gap-3 items-center rounded-md px-3 py-2 ${
                project.id === activeProjectId ? 'bg-orange-500/10' : 'bg-white/[0.03]'
              }`}
            >
              <button
                onClick={() => void onSwitchProject(project.id)}
                className="text-left min-w-0"
              >
                <div className="text-sm text-gray-200 truncate">{project.name}</div>
                <div className="text-[10px] text-gray-600 font-mono">{new Date(project.createdAt).toLocaleString()}</div>
              </button>
              <div className="flex items-center gap-1">
                {project.id === activeProjectId && (
                  <button onClick={() => void exportActiveProjectBackup()} className="h-7 px-2 rounded text-xs text-gray-300 hover:bg-white/5" title="Export active project backup">Export</button>
                )}
                <button onClick={() => void rename(project)} className="h-7 px-2 rounded text-xs text-gray-300 hover:bg-white/5">Rename</button>
                <button onClick={() => void duplicate(project)} className="h-7 px-2 rounded text-xs text-gray-300 hover:bg-white/5">Duplicate</button>
                <button
                  onClick={() => deleteProject(project)}
                  disabled={projects.length <= 1}
                  className="h-7 px-2 rounded text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-30"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
