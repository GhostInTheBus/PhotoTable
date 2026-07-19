// src/store/store.ts
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { Clump, CLUMP_COLORS, Folder, LibraryImage, PlacedPhoto, Project, Viewport } from './types'

interface LibrarySlice {
  folders: Folder[]
  activeFolderId: string | null
}

interface CanvasSlice {
  photos: PlacedPhoto[]
  clumps: Clump[]
  clumpCounter: number
  viewport: Viewport
}

type CanvasSnapshot = CanvasSlice

interface UISlice {
  selectedIds: string[]
  draggingIds: string[]
  showFilenames: boolean
  saveStatus: 'saved' | 'saving' | 'error'
  saveError: string | null
  undoStack: CanvasSnapshot[]
  redoStack: CanvasSnapshot[]
  modal: AppModal | null
}

export type AppModal =
  | {
      type: 'confirm'
      title: string
      message: string
      confirmLabel?: string
      cancelLabel?: string
      danger?: boolean
      onConfirm: () => void | Promise<void>
    }
  | {
      type: 'prompt'
      title: string
      message?: string
      initialValue: string
      confirmLabel?: string
      cancelLabel?: string
      onConfirm: (value: string) => void | Promise<void>
    }

interface ProjectsSlice {
  projects: Project[]
  activeProjectId: string
}

interface StoreActions {
  addFolder: (folder: Folder) => void
  setFolderImages: (folderId: string, images: LibraryImage[]) => void
  removeFolder: (id: string) => void
  setActiveFolderId: (id: string | null) => void
  addPhoto: (photo: PlacedPhoto) => void
  movePhoto: (id: string, x: number, y: number, recordHistory?: boolean) => void
  movePhotos: (ids: string[], dx: number, dy: number, recordHistory?: boolean) => void
  removePhoto: (id: string) => void
  removePhotos: (ids: string[]) => void
  setPhotoRotation: (id: string, rotation: number) => void
  setPhotoScale: (id: string, scale: number, recordHistory?: boolean) => void
  bringToFront: (id: string, recordHistory?: boolean) => void
  bringGroupToFront: (ids: string[], recordHistory?: boolean) => void
  setViewport: (viewport: Viewport) => void
  setSelectedIds: (ids: string[]) => void
  setDraggingIds: (ids: string[]) => void
  toggleFilenames: () => void
  setSaveStatus: (status: 'saved' | 'saving' | 'error', error?: string | null) => void
  openModal: (modal: AppModal) => void
  closeModal: () => void
  createClump: (photoIds: string[]) => void
  renameClump: (clumpId: string, name: string) => void
  removeClump: (clumpId: string) => void
  unclumpPhotos: (photoIds: string[]) => void
  clearTable: () => void
  setClumps: (clumps: Clump[]) => void
  captureHistory: () => void
  undo: () => void
  redo: () => void
  alignSelected: (mode: 'left' | 'right' | 'top' | 'bottom' | 'center-x' | 'center-y') => void
  distributeSelected: (axis: 'x' | 'y') => void
  normalizeSelectedScale: () => void
  relinkMissingPhotos: () => void
  // project actions
  setProjects: (projects: Project[]) => void
  addProject: (project: Project) => void
  duplicateProject: (project: Project, canvas: CanvasSnapshot) => void
  setActiveProjectId: (id: string) => void
  updateProjectName: (id: string, name: string) => void
  removeProject: (id: string) => void
  restoreCanvas: (canvas: { photos: PlacedPhoto[]; clumps: Clump[]; clumpCounter: number; viewport: Viewport }) => void
}

type StoreState = { library: LibrarySlice; canvas: CanvasSlice; ui: UISlice; projects: ProjectsSlice } & StoreActions

export const useStore = create<StoreState>()(
  subscribeWithSelector((set, get) => {
    const snapshotCanvas = (canvas = get().canvas): CanvasSnapshot => ({
      photos: canvas.photos.map((p) => ({ ...p })),
      clumps: canvas.clumps.map((c) => ({ ...c })),
      clumpCounter: canvas.clumpCounter,
      viewport: { ...canvas.viewport },
    })

    const withHistory = (updater: (s: StoreState) => Partial<StoreState>) =>
      set((s) => ({
        ...updater(s),
        ui: {
          ...s.ui,
          undoStack: [...s.ui.undoStack, snapshotCanvas(s.canvas)].slice(-75),
          redoStack: [],
        },
      }))

    const photoSize = (photo: PlacedPhoto) => {
      const image = get().library.folders
        .flatMap((folder) => folder.images)
        .find((img) => img.id === photo.libraryImageId)
      const ratio = image?.width && image?.height ? image.height / image.width : 0.67
      const width = 240 * photo.scale
      return { width, height: width * ratio }
    }

    return ({
    library: { folders: [], activeFolderId: null },
    canvas: { photos: [], clumps: [], clumpCounter: 0, viewport: { x: 0, y: 0, zoom: 1 } },
    ui: {
      selectedIds: [],
      draggingIds: [],
      showFilenames: true,
      saveStatus: 'saved',
      saveError: null,
      undoStack: [],
      redoStack: [],
      modal: null,
    },
    projects: { projects: [], activeProjectId: '' },

    addFolder: (folder) =>
      set((s) => ({ library: { ...s.library, folders: [...s.library.folders, folder] } })),
    setFolderImages: (folderId, images) =>
      set((s) => ({
        library: {
          ...s.library,
          folders: s.library.folders.map((f) =>
            f.id === folderId ? { ...f, images, loaded: true } : f
          ),
        },
      })),
    removeFolder: (id) =>
      set((s) => ({
        library: {
          ...s.library,
          folders: s.library.folders.filter((f) => f.id !== id),
        },
      })),
    setActiveFolderId: (id) =>
      set((s) => ({ library: { ...s.library, activeFolderId: id } })),

    addPhoto: (photo) =>
      withHistory((s) => ({ canvas: { ...s.canvas, photos: [...s.canvas.photos, photo] } })),
    movePhoto: (id, x, y, recordHistory = true) =>
      (recordHistory ? withHistory : set)((s) => ({
        canvas: {
          ...s.canvas,
          photos: s.canvas.photos.map((p) => (p.id === id ? { ...p, x, y } : p)),
        },
      })),
    movePhotos: (ids, dx, dy, recordHistory = true) =>
      (recordHistory ? withHistory : set)((s) => ({
        canvas: {
          ...s.canvas,
          photos: s.canvas.photos.map((p) =>
            ids.includes(p.id) ? { ...p, x: p.x + dx, y: p.y + dy } : p
          ),
        },
      })),
    removePhoto: (id) =>
      withHistory((s) => ({
        canvas: { ...s.canvas, photos: s.canvas.photos.filter((p) => p.id !== id) },
      })),
    removePhotos: (ids) =>
      withHistory((s) => ({
        canvas: { ...s.canvas, photos: s.canvas.photos.filter((p) => !ids.includes(p.id)) },
      })),
    setPhotoRotation: (id, rotation) =>
      withHistory((s) => ({
        canvas: {
          ...s.canvas,
          photos: s.canvas.photos.map((p) => (p.id === id ? { ...p, rotation } : p)),
        },
      })),
    setPhotoScale: (id, scale, recordHistory = true) =>
      (recordHistory ? withHistory : set)((s) => ({
        canvas: {
          ...s.canvas,
          photos: s.canvas.photos.map((p) => (p.id === id ? { ...p, scale } : p)),
        },
      })),
    bringToFront: (id, recordHistory = true) =>
      (recordHistory ? withHistory : set)((s) => {
        const maxZ = Math.max(0, ...s.canvas.photos.map((p) => p.zIndex))
        return {
          canvas: {
            ...s.canvas,
            photos: s.canvas.photos.map((p) => (p.id === id ? { ...p, zIndex: maxZ + 1 } : p)),
          },
        }
      }),
    bringGroupToFront: (ids, recordHistory = true) =>
      (recordHistory ? withHistory : set)((s) => {
        const maxZ = Math.max(0, ...s.canvas.photos.map((p) => p.zIndex))
        let groupIndex = 0
        return {
          canvas: {
            ...s.canvas,
            photos: s.canvas.photos.map((p) =>
              ids.includes(p.id) ? { ...p, zIndex: maxZ + (++groupIndex) } : p
            ),
          },
        }
      }),
    setViewport: (viewport) =>
      set((s) => ({ canvas: { ...s.canvas, viewport } })),

    setSelectedIds: (ids) => set((s) => ({ ui: { ...s.ui, selectedIds: ids } })),
    setDraggingIds: (ids) => set((s) => ({ ui: { ...s.ui, draggingIds: ids } })),
    toggleFilenames: () => set((s) => ({ ui: { ...s.ui, showFilenames: !s.ui.showFilenames } })),
    setSaveStatus: (status, error = null) =>
      set((s) => ({ ui: { ...s.ui, saveStatus: status, saveError: error } })),
    openModal: (modal) => set((s) => ({ ui: { ...s.ui, modal } })),
    closeModal: () => set((s) => ({ ui: { ...s.ui, modal: null } })),

    createClump: (photoIds) =>
      withHistory((s) => {
        const counter = s.canvas.clumpCounter + 1
        const color = CLUMP_COLORS[(counter - 1) % CLUMP_COLORS.length]
        const name = `Clump ${counter}`
        const id = `clump-${crypto.randomUUID()}`
        const newClump: Clump = { id, name, color }
        return {
          canvas: {
            ...s.canvas,
            clumpCounter: counter,
            clumps: [...s.canvas.clumps, newClump],
            photos: s.canvas.photos.map((p) =>
              photoIds.includes(p.id) ? { ...p, clumpId: id } : p
            ),
          },
        }
      }),

    renameClump: (clumpId, name) =>
      withHistory((s) => ({
        canvas: {
          ...s.canvas,
          clumps: s.canvas.clumps.map((c) => (c.id === clumpId ? { ...c, name } : c)),
        },
      })),

    removeClump: (clumpId) =>
      withHistory((s) => ({
        canvas: {
          ...s.canvas,
          clumps: s.canvas.clumps.filter((c) => c.id !== clumpId),
          photos: s.canvas.photos.map((p) =>
            p.clumpId === clumpId ? { ...p, clumpId: null } : p
          ),
        },
      })),

    unclumpPhotos: (photoIds) =>
      withHistory((s) => {
        const updated = s.canvas.photos.map((p) =>
          photoIds.includes(p.id) ? { ...p, clumpId: null } : p
        )
        // Remove clumps that now have no members
        const remainingClumpIds = new Set(updated.map((p) => p.clumpId).filter(Boolean))
        const clumps = s.canvas.clumps.filter((c) => remainingClumpIds.has(c.id))
        return { canvas: { ...s.canvas, photos: updated, clumps } }
      }),

    clearTable: () =>
      withHistory((s) => ({
        canvas: { ...s.canvas, photos: [], clumps: [], clumpCounter: 0 },
      })),

    setClumps: (clumps) =>
      withHistory((s) => ({ canvas: { ...s.canvas, clumps } })),

    captureHistory: () =>
      set((s) => ({
        ui: {
          ...s.ui,
          undoStack: [...s.ui.undoStack, snapshotCanvas(s.canvas)].slice(-75),
          redoStack: [],
        },
      })),
    undo: () =>
      set((s) => {
        const previous = s.ui.undoStack[s.ui.undoStack.length - 1]
        if (!previous) return {}
        return {
          canvas: snapshotCanvas(previous),
          ui: {
            ...s.ui,
            selectedIds: [],
            draggingIds: [],
            undoStack: s.ui.undoStack.slice(0, -1),
            redoStack: [...s.ui.redoStack, snapshotCanvas(s.canvas)].slice(-75),
          },
        }
      }),
    redo: () =>
      set((s) => {
        const next = s.ui.redoStack[s.ui.redoStack.length - 1]
        if (!next) return {}
        return {
          canvas: snapshotCanvas(next),
          ui: {
            ...s.ui,
            selectedIds: [],
            draggingIds: [],
            redoStack: s.ui.redoStack.slice(0, -1),
            undoStack: [...s.ui.undoStack, snapshotCanvas(s.canvas)].slice(-75),
          },
        }
      }),
    alignSelected: (mode) =>
      withHistory((s) => {
        const ids = s.ui.selectedIds
        const selected = s.canvas.photos.filter((p) => ids.includes(p.id))
        if (selected.length < 2) return {}
        const boxes = selected.map((p) => ({ photo: p, ...photoSize(p) }))
        const target = mode === 'left'
          ? Math.min(...boxes.map((b) => b.photo.x))
          : mode === 'right'
            ? Math.max(...boxes.map((b) => b.photo.x + b.width))
            : mode === 'top'
              ? Math.min(...boxes.map((b) => b.photo.y))
              : mode === 'bottom'
                ? Math.max(...boxes.map((b) => b.photo.y + b.height))
                : mode === 'center-x'
                  ? boxes.reduce((sum, b) => sum + b.photo.x + b.width / 2, 0) / boxes.length
                  : boxes.reduce((sum, b) => sum + b.photo.y + b.height / 2, 0) / boxes.length
        return {
          canvas: {
            ...s.canvas,
            photos: s.canvas.photos.map((p) => {
              if (!ids.includes(p.id)) return p
              const size = photoSize(p)
              if (mode === 'left') return { ...p, x: target }
              if (mode === 'right') return { ...p, x: target - size.width }
              if (mode === 'top') return { ...p, y: target }
              if (mode === 'bottom') return { ...p, y: target - size.height }
              if (mode === 'center-x') return { ...p, x: target - size.width / 2 }
              return { ...p, y: target - size.height / 2 }
            }),
          },
        }
      }),
    distributeSelected: (axis) =>
      withHistory((s) => {
        const ids = s.ui.selectedIds
        const selected = s.canvas.photos.filter((p) => ids.includes(p.id))
        if (selected.length < 3) return {}
        const sorted = [...selected].sort((a, b) => axis === 'x' ? a.x - b.x : a.y - b.y)
        const first = sorted[0]
        const last = sorted[sorted.length - 1]
        const span = (axis === 'x' ? last.x - first.x : last.y - first.y)
        const step = span / (sorted.length - 1)
        const positions = new Map(sorted.map((p, i) => [p.id, (axis === 'x' ? first.x : first.y) + step * i]))
        return {
          canvas: {
            ...s.canvas,
            photos: s.canvas.photos.map((p) => {
              const pos = positions.get(p.id)
              if (pos == null) return p
              return axis === 'x' ? { ...p, x: pos } : { ...p, y: pos }
            }),
          },
        }
      }),
    normalizeSelectedScale: () =>
      withHistory((s) => {
        const ids = s.ui.selectedIds
        if (ids.length < 2) return {}
        const selected = s.canvas.photos.filter((p) => ids.includes(p.id))
        const scale = selected[0]?.scale ?? 1
        return {
          canvas: {
            ...s.canvas,
            photos: s.canvas.photos.map((p) => ids.includes(p.id) ? { ...p, scale } : p),
          },
        }
      }),
    relinkMissingPhotos: () =>
      withHistory((s) => {
        const images = s.library.folders.flatMap((folder) => folder.images)
        const existingIds = new Set(images.map((img) => img.id))
        const imagesByFilename = new Map(images.map((img) => [img.filename.toLowerCase(), img]))
        let changed = false
        const photos = s.canvas.photos.map((photo) => {
          if (existingIds.has(photo.libraryImageId) || !photo.filenameHint) return photo
          const replacement = imagesByFilename.get(photo.filenameHint.toLowerCase())
          if (!replacement) return photo
          changed = true
          return { ...photo, libraryImageId: replacement.id, filenameHint: replacement.filename }
        })
        return changed ? { canvas: { ...s.canvas, photos } } : {}
      }),

    setProjects: (projects) =>
      set((s) => ({ projects: { ...s.projects, projects } })),
    addProject: (project) =>
      set((s) => ({ projects: { ...s.projects, projects: [...s.projects.projects, project] } })),
    duplicateProject: (project, canvas) =>
      set((s) => ({
        projects: { ...s.projects, projects: [...s.projects.projects, project], activeProjectId: project.id },
        canvas,
        ui: { ...s.ui, selectedIds: [], draggingIds: [], undoStack: [], redoStack: [] },
      })),
    setActiveProjectId: (id) =>
      set((s) => ({ projects: { ...s.projects, activeProjectId: id } })),
    updateProjectName: (id, name) =>
      set((s) => ({
        projects: {
          ...s.projects,
          projects: s.projects.projects.map((p) => (p.id === id ? { ...p, name } : p)),
        },
      })),
    removeProject: (id) =>
      set((s) => ({
        projects: {
          ...s.projects,
          projects: s.projects.projects.filter((p) => p.id !== id),
        },
      })),
    restoreCanvas: (canvas) => set((s) => ({ canvas, ui: { ...s.ui, undoStack: [], redoStack: [] } })),
  })})
)
