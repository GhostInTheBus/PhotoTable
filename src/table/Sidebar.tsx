import { useState, useEffect, useRef, useCallback } from 'react'
import { useStore } from '../store/store'
import { FolderPanel } from './FolderPanel'
import { ProjectManager } from './ProjectManager'
import { pickFolder, pickFolderFiles, listImageFiles, generateFolderId, generateImageId } from '../lib/fileSystem'
import { createThumbnailFromBlob, createThumbnailFromFileHandle } from '../lib/imageLoader'
import {
  saveFolderHandle,
  deleteFolderHandle,
  saveProject,
  deleteProjectRecord,
  saveImportedImage,
  deleteImportedImages,
  loadCanvasState,
} from '../lib/db'
import { flushSave } from '../store/persist'
import { Folder, LibraryImage, Project, PlacedPhoto, Clump } from '../store/types'
import { Viewport } from '../store/types'
import { revokeObjectUrls } from '../lib/objectUrls'
import {
  getSidebarWidth,
  getThumbDensity,
  setSidebarWidthPreference,
  setThumbDensityPreference,
  ThumbDensity,
} from '../lib/preferences'

function ProjectItem({
  project,
  isActive,
  canDelete,
  onSelect,
  onRename,
  onDelete,
}: {
  project: Project
  isActive: boolean
  canDelete: boolean
  onSelect: () => void
  onRename: (name: string) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(project.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  function commitRename() {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== project.name) onRename(trimmed)
    else setDraft(project.name)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="px-2 py-0.5">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename()
            if (e.key === 'Escape') { setDraft(project.name); setEditing(false) }
          }}
          className="w-full bg-gray-700 border border-gray-500 text-gray-100 font-mono text-xs px-2 py-0.5 rounded outline-none"
        />
      </div>
    )
  }

  return (
    <div
      className={`group flex items-center justify-between px-2 py-1 mx-1 rounded cursor-pointer border-l-2 transition-colors ${
        isActive
          ? 'bg-orange-500/10 text-orange-100 border-orange-500'
          : 'text-gray-400 hover:bg-white/5 hover:text-gray-200 border-transparent'
      }`}
      onClick={onSelect}
      onDoubleClick={() => setEditing(true)}
    >
      <span className="font-mono text-xs truncate flex-1">{project.name}</span>
      {canDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 font-mono text-xs ml-1 leading-none"
          title="Delete project"
        >
          ×
        </button>
      )}
    </div>
  )
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [filterText, setFilterText] = useState('')
  const [thumbDensity, setThumbDensity] = useState<ThumbDensity>(getThumbDensity)
  const [isSwitchingProject, setIsSwitchingProject] = useState(false)
  const [showProjectManager, setShowProjectManager] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(getSidebarWidth)
  const isDraggingHandle = useRef(false)
  const projectSwitchToken = useRef(0)

  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    isDraggingHandle.current = true
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const handleResizeMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingHandle.current) return
    const newWidth = Math.max(160, Math.min(520, e.clientX))
    setSidebarWidth(newWidth)
    setSidebarWidthPreference(newWidth)
  }, [])

  const handleResizeEnd = useCallback(() => {
    isDraggingHandle.current = false
  }, [])

  const { library, addFolder, setFolderImages, removeFolder } = useStore()
  const projects = useStore((s) => s.projects.projects)
  const activeProjectId = useStore((s) => s.projects.activeProjectId)
  const { addProject, setActiveProjectId, updateProjectName, removeProject, restoreCanvas, openModal } = useStore()

  useEffect(() => {
    setThumbDensityPreference(thumbDensity)
  }, [thumbDensity])

  useEffect(() => {
    let lastRefresh = Date.now()
    const onFocus = () => {
      if (Date.now() - lastRefresh < 5 * 60_000) return
      lastRefresh = Date.now()
      useStore.getState().library.folders.forEach((f) => {
        if (f.handle) void loadFolderThumbnails(f.id, f.handle)
      })
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
    // loadFolderThumbnails reads fresh folder state internally; focus refresh does not need render-time captures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function switchProject(projectId: string) {
    if (projectId === activeProjectId || isSwitchingProject) return
    const token = ++projectSwitchToken.current
    setIsSwitchingProject(true)

    try {
      // Flush pending save for current project before switching
      await flushSave(activeProjectId)

      // Load the new project's canvas
      const saved = await loadCanvasState(projectId)
      if (token !== projectSwitchToken.current) return

      // Switch active project
      setActiveProjectId(projectId)

      // Restore canvas (or blank if new project)
      restoreCanvas({
        photos: ((saved?.photos ?? []) as PlacedPhoto[]),
        clumps: ((saved?.clumps ?? []) as Clump[]),
        clumpCounter: saved?.clumpCounter ?? 0,
        viewport: ((saved?.viewport ?? { x: 0, y: 0, zoom: 1 }) as Viewport),
      })

      // Clear selection
      useStore.getState().setSelectedIds([])
      useStore.getState().setDraggingIds([])
    } finally {
      if (token === projectSwitchToken.current) setIsSwitchingProject(false)
    }
  }

  async function handleCreateProject() {
    const newProject: Project = {
      id: `proj-${crypto.randomUUID()}`,
      name: `Project ${projects.length + 1}`,
      createdAt: Date.now(),
    }
    await saveProject(newProject)
    addProject(newProject)
    await switchProject(newProject.id)
  }

  async function handleRenameProject(id: string, name: string) {
    const project = projects.find((p) => p.id === id)
    if (!project) return
    const updated = { ...project, name }
    await saveProject(updated)
    updateProjectName(id, name)
  }

  async function handleDeleteProject(id: string) {
    if (projects.length <= 1) return
    const name = projects.find((p) => p.id === id)?.name ?? 'Untitled'
    openModal({
      type: 'confirm',
      title: `Delete "${name}"?`,
      message: 'This removes the project and its saved canvas from this browser. This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        // If deleting active project, switch to another first
        if (id === activeProjectId) {
          const other = projects.find((p) => p.id !== id)!
          await switchProject(other.id)
        }

        await deleteProjectRecord(id)
        removeProject(id)
      },
    })
  }

  async function loadFolderThumbnails(folderId: string, handle: FileSystemDirectoryHandle) {
    const fileHandles = await listImageFiles(handle)
    const BATCH_SIZE = 8
    const accumulated: LibraryImage[] = []
    const previousUrls = useStore.getState().library.folders
      .find((f) => f.id === folderId)?.images.map((img) => img.thumbnailUrl) ?? []

    for (let i = 0; i < fileHandles.length; i += BATCH_SIZE) {
      const batch = fileHandles.slice(i, i + BATCH_SIZE)
      const results = await Promise.all(
        batch.map(async (fh) => {
          try {
            const thumbnail = await createThumbnailFromFileHandle(fh)
            return {
              id: generateImageId(handle.name, fh.name),
              filename: fh.name,
              folderPath: handle.name,
              fileHandle: fh,
              thumbnailUrl: thumbnail.url,
              source: 'folder-handle',
              width: thumbnail.width,
              height: thumbnail.height,
            } as LibraryImage
          } catch (error) {
            console.error(`Failed to create thumbnail for ${fh.name}:`, error)
            return null
          }
        })
      )
      accumulated.push(...results.filter((image): image is LibraryImage => image !== null))
      // Progressive update — show thumbnails as each batch finishes
      setFolderImages(folderId, [...accumulated])
    }
    revokeObjectUrls(previousUrls)
  }

  async function loadFolderFilesAsThumbnails(folderId: string, folderName: string, files: File[]) {
    const BATCH_SIZE = 8
    const accumulated: LibraryImage[] = []
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE)
      const results = await Promise.all(
        batch.map(async (file) => {
          try {
            const thumbnail = await createThumbnailFromBlob(file)
            if (!thumbnail.url) return null
            const id = generateImageId(folderName, file.name)
            await saveImportedImage({ id, filename: file.name, folderPath: folderName, blob: file })
            return {
              id,
              filename: file.name,
              folderPath: folderName,
              fileHandle: null,
              thumbnailUrl: thumbnail.url,
              source: 'imported-blob',
              width: thumbnail.width,
              height: thumbnail.height,
            } as LibraryImage
          } catch {
            return null
          }
        })
      )
      accumulated.push(...results.filter((image): image is LibraryImage => image !== null))
      setFolderImages(folderId, [...accumulated])
    }
  }

  async function handleAddFolder() {
    if (typeof window.showDirectoryPicker === 'function') {
      // Chrome / Edge: File System Access API
      const handle = await pickFolder()
      if (!handle) return
      const id = generateFolderId(handle.name)
      const folder: Folder = { id, name: handle.name, handle, images: [], loaded: false }
      addFolder(folder)
      await saveFolderHandle(id, handle)
      await loadFolderThumbnails(id, handle)
    } else {
      // Firefox fallback: <input webkitdirectory>
      const result = await pickFolderFiles()
      if (!result) return
      const id = generateFolderId(result.name)
      const folder: Folder = {
        id, name: result.name,
        handle: null,
        images: [], loaded: false,
      }
      addFolder(folder)
      await loadFolderFilesAsThumbnails(id, result.name, result.files)
    }
  }

  async function refreshFolder(folderId: string) {
    const folder = useStore.getState().library.folders.find((f) => f.id === folderId)
    if (!folder || !folder.handle) return
    await loadFolderThumbnails(folderId, folder.handle)
  }

  async function handleRemoveFolder(folderId: string) {
    const folder = useStore.getState().library.folders.find((f) => f.id === folderId)
    await deleteFolderHandle(folderId)
    if (folder) {
      revokeObjectUrls(folder.images.map((img) => img.thumbnailUrl))
      await deleteImportedImages(folder.images
        .filter((img) => img.source === 'imported-blob' || !img.fileHandle)
        .map((img) => img.id))
    }
    removeFolder(folderId)
  }

  function handleAddAll(folderId: string) {
    const folder = useStore.getState().library.folders.find((f) => f.id === folderId)
    if (!folder || folder.images.length === 0) return

    const state = useStore.getState()
    const unplaced = folder.images.filter(
      (img) => !state.canvas.photos.some((p) => p.libraryImageId === img.id)
    )
    if (unplaced.length === 0) return

    const vp = state.canvas.viewport
    const maxZ = Math.max(0, ...state.canvas.photos.map((p) => p.zIndex))
    const SPACING = 260
    const COLS = Math.max(1, Math.ceil(Math.sqrt(unplaced.length)))
    const gridW = COLS * SPACING
    const gridH = Math.ceil(unplaced.length / COLS) * SPACING
    const startX = (window.innerWidth / 2 - vp.x) / vp.zoom - gridW / 2
    const startY = (window.innerHeight / 2 - vp.y) / vp.zoom - gridH / 2

    unplaced.forEach((img, i) => {
      useStore.getState().addPhoto({
        id: `placed-${img.id}-${Date.now()}-${i}`,
        libraryImageId: img.id,
        filenameHint: img.filename,
        x: startX + (i % COLS) * SPACING,
        y: startY + Math.floor(i / COLS) * SPACING,
        rotation: 0,
        scale: 1,
        zIndex: maxZ + i + 1,
        clumpId: null,
      })
    })
  }

  const filteredFolders = library.folders.map((folder) => ({
    ...folder,
    images: filterText
      ? folder.images.filter((img) =>
          img.filename.toLowerCase().includes(filterText.toLowerCase())
        )
      : folder.images,
  }))

  if (collapsed) {
    return (
      <div className="w-8 h-full bg-gray-900 border-r border-gray-800 flex items-start justify-center pt-3 shrink-0">
        <button
          onClick={() => setCollapsed(false)}
          className="text-gray-500 hover:text-white font-mono text-xs"
          title="Expand sidebar"
        >
          »
        </button>
      </div>
    )
  }

  return (
    <div
      className="h-full bg-gray-900 border-r border-gray-800 flex flex-col relative shrink-0"
      style={{ width: sidebarWidth }}
    >
      {/* Drag handle on right edge */}
      <div
        onPointerDown={handleResizeStart}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeEnd}
        onPointerCancel={handleResizeEnd}
        style={{
          position: 'absolute',
          top: 0,
          right: -3,
          width: 6,
          bottom: 0,
          cursor: 'col-resize',
          zIndex: 20,
        }}
      />
      <div className="flex items-center justify-between px-2 pt-2 pb-1 border-b border-gray-800">
        <span className="text-gray-400 text-xs font-semibold tracking-widest uppercase">PhotoTable</span>
        <a
          href="https://github.com/GhostInTheBus/PhotoTable"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-600 hover:text-gray-300 font-mono text-xs"
          title="View on GitHub"
        >
          gh
        </a>
        <button
          onClick={() => setCollapsed(true)}
          className="text-gray-600 hover:text-gray-300 font-mono text-xs"
        >
          «
        </button>
      </div>

      {/* Projects section */}
      <div className="border-b border-gray-800 pb-1">
        <div className="flex items-center justify-between px-2 pt-2 pb-1">
          <span className="text-gray-500 text-xs font-medium uppercase tracking-wider">Projects</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowProjectManager(true)}
              className="text-gray-600 hover:text-gray-300 font-mono text-xs"
              title="Project manager"
            >
              mgr
            </button>
            <button
              onClick={handleCreateProject}
              className="text-gray-600 hover:text-gray-300 font-mono text-xs"
              title="New project"
            >
              +
            </button>
          </div>
        </div>
        <div className="space-y-0.5">
          {projects.map((project) => (
            <ProjectItem
              key={project.id}
              project={project}
              isActive={project.id === activeProjectId}
              canDelete={projects.length > 1}
              onSelect={() => { if (!isSwitchingProject) void switchProject(project.id) }}
              onRename={(name) => handleRenameProject(project.id, name)}
              onDelete={() => handleDeleteProject(project.id)}
            />
          ))}
        </div>
      </div>

      {/* Library section */}
      <div className="flex items-center justify-between px-2 pt-2 pb-1">
        <span className="text-gray-500 text-xs font-medium uppercase tracking-wider">Library</span>
        <div className="flex items-center gap-0.5">
          {(['small', 'medium', 'large'] as const).map((size) => (
            <button
              key={size}
              onClick={() => setThumbDensity(size)}
              className={`w-5 h-5 rounded text-[10px] ${
                thumbDensity === size
                  ? 'bg-orange-500/20 text-orange-200'
                  : 'text-gray-600 hover:text-gray-300 hover:bg-white/5'
              }`}
              title={`${size} thumbnails`}
            >
              {size[0].toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="px-2 pb-1">
        <input
          type="text"
          placeholder="Filter filenames..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 text-gray-300 font-mono text-sm px-3 py-2 rounded placeholder-gray-600 outline-none focus:border-gray-500"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredFolders.map((folder) => (
          <FolderPanel
            key={folder.id}
            folder={folder}
            onRefresh={refreshFolder}
            onRemove={handleRemoveFolder}
            onAddAll={handleAddAll}
            density={thumbDensity}
          />
        ))}
        {library.folders.length === 0 && (
          <p className="text-gray-700 font-mono text-xs px-2 py-4 text-center">
            No folders loaded
          </p>
        )}
      </div>

      <div className="px-2 py-2 border-t border-gray-800">
        <button
          onClick={handleAddFolder}
          className="w-full py-2.5 text-sm text-gray-300 hover:text-orange-200 rounded-lg border transition-all"
          style={{
            background: 'rgba(255,255,255,0.04)',
            borderColor: 'rgba(255,255,255,0.08)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(249,115,22,0.12)'
            e.currentTarget.style.borderColor = 'rgba(249,115,22,0.3)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
          }}
        >
          + Add Folder
        </button>
      </div>
      {showProjectManager && (
        <ProjectManager
          onClose={() => setShowProjectManager(false)}
          onSwitchProject={switchProject}
        />
      )}
    </div>
  )
}
