import { useStore } from '../store/store'
import { Clump, LibraryImage, PlacedPhoto, Project, Viewport } from '../store/types'
import {
  loadCanvasState,
  loadFolderHandles,
  loadImportedImages,
  loadLegacyCanvasState,
  loadProjects,
  saveCanvasState,
  saveProject,
} from './db'
import { generateImageId, listImageFiles } from './fileSystem'
import { createThumbnailFromBlob, createThumbnailFromFileHandle } from './imageLoader'

export interface RestoreSessionResult {
  warnings: string[]
}

export async function restoreSession(): Promise<RestoreSessionResult> {
  const warnings: string[] = []
  let projects = await loadProjects()

  if (projects.length === 0) {
    const defaultProject: Project = {
      id: `proj-${crypto.randomUUID()}`,
      name: 'Default',
      createdAt: Date.now(),
    }
    await saveProject(defaultProject)

    const legacy = await loadLegacyCanvasState()
    if (legacy) {
      await saveCanvasState(
        {
          photos: legacy.photos ?? [],
          clumps: legacy.clumps ?? [],
          clumpCounter: legacy.clumpCounter ?? 0,
          viewport: legacy.viewport ?? { x: 0, y: 0, zoom: 1 },
        },
        defaultProject.id
      )
    }
    projects = [defaultProject]
  }

  projects.sort((a, b) => a.createdAt - b.createdAt)
  useStore.getState().setProjects(projects)
  const activeId = projects[0].id
  useStore.getState().setActiveProjectId(activeId)

  const saved = await loadCanvasState(activeId)
  if (saved) {
    useStore.getState().restoreCanvas({
      photos: (saved.photos ?? []) as PlacedPhoto[],
      clumps: (saved.clumps ?? []) as Clump[],
      clumpCounter: saved.clumpCounter ?? 0,
      viewport: (saved.viewport ?? { x: 0, y: 0, zoom: 1 }) as Viewport,
    })
  }

  const handles = await loadFolderHandles()
  for (const { id, handle } of handles) {
    try {
      await handle.requestPermission({ mode: 'read' })
      useStore.getState().addFolder({ id, name: handle.name, handle, images: [], loaded: false })
      const fileHandles = await listImageFiles(handle)

      const batchSize = 8
      const accumulated: LibraryImage[] = []
      let failedThumbnails = 0
      for (let i = 0; i < fileHandles.length; i += batchSize) {
        const batch = fileHandles.slice(i, i + batchSize)
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
            } catch {
              failedThumbnails += 1
              return null
            }
          })
        )
        accumulated.push(...results.filter((image): image is LibraryImage => image !== null))
        useStore.getState().setFolderImages(id, [...accumulated])
      }
      if (failedThumbnails > 0) {
        warnings.push(`${failedThumbnails} image${failedThumbnails === 1 ? '' : 's'} in "${handle.name}" could not be restored.`)
      }
    } catch {
      warnings.push(`Folder "${handle.name}" needs permission again before its images can be restored.`)
    }
  }

  const importedImages = await loadImportedImages()
  if (importedImages.length > 0) {
    const byFolder = new Map<string, LibraryImage[]>()
    let failedImported = 0
    for (const image of importedImages) {
      try {
        const thumbnail = await createThumbnailFromBlob(image.blob)
        const folderImages = byFolder.get(image.folderPath) ?? []
        folderImages.push({
          id: image.id,
          filename: image.filename,
          folderPath: image.folderPath,
          fileHandle: null,
          thumbnailUrl: thumbnail.url,
          source: 'imported-blob',
          width: thumbnail.width,
          height: thumbnail.height,
        })
        byFolder.set(image.folderPath, folderImages)
      } catch {
        failedImported += 1
      }
    }

    for (const [folderPath, images] of byFolder) {
      const id = folderPath === 'Finder Drop' ? 'finder-drop' : `imported-${folderPath}`
      useStore.getState().addFolder({
        id,
        name: folderPath,
        handle: null,
        images,
        loaded: true,
      })
    }

    if (failedImported > 0) {
      warnings.push(`${failedImported} imported image${failedImported === 1 ? '' : 's'} could not be restored.`)
    }
  }

  return { warnings }
}
