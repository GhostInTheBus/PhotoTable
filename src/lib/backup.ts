import { loadImportedImages, saveImportedImage } from './db'
import { downloadTextFile } from './export'
import { createThumbnailFromBlob } from './imageLoader'
import { useStore } from '../store/store'
import { Folder, LibraryImage } from '../store/types'
import { CANVAS_SCHEMA_VERSION, PhotoTableBackup, parsePhotoTableBackup } from './schema'

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob'))
    reader.readAsDataURL(blob)
  })
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, payload] = dataUrl.split(',')
  const mime = header.match(/data:(.*?);base64/)?.[1] ?? 'application/octet-stream'
  const binary = atob(payload)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export async function exportActiveProjectBackup(): Promise<void> {
  const state = useStore.getState()
  const usedImageIds = new Set(state.canvas.photos.map((photo) => photo.libraryImageId))
  const imported = await loadImportedImages()
  const importedImages = await Promise.all(
    imported
      .filter((image) => usedImageIds.has(image.id))
      .map(async (image) => ({
        id: image.id,
        filename: image.filename,
        folderPath: image.folderPath,
        dataUrl: await blobToDataUrl(image.blob),
      }))
  )

  const backup: PhotoTableBackup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    activeProjectId: state.projects.activeProjectId,
    canvas: { schemaVersion: CANVAS_SCHEMA_VERSION, ...state.canvas },
    importedImages,
  }

  const projectName = state.projects.projects.find((p) => p.id === state.projects.activeProjectId)?.name ?? 'project'
  const safeName = projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'project'
  downloadTextFile(JSON.stringify(backup, null, 2), `phototable-${safeName}.json`)
}

export async function importProjectBackup(file: File): Promise<void> {
  const parsed = parsePhotoTableBackup(JSON.parse(await file.text()))

  const importedByFolder = new Map<string, LibraryImage[]>()
  for (const image of parsed.importedImages ?? []) {
    const blob = dataUrlToBlob(image.dataUrl)
    await saveImportedImage({ id: image.id, filename: image.filename, folderPath: image.folderPath, blob })
    const thumbnail = await createThumbnailFromBlob(blob)
    const images = importedByFolder.get(image.folderPath) ?? []
    images.push({
      id: image.id,
      filename: image.filename,
      folderPath: image.folderPath,
      fileHandle: null,
      thumbnailUrl: thumbnail.url,
      source: 'imported-blob',
      width: thumbnail.width,
      height: thumbnail.height,
    })
    importedByFolder.set(image.folderPath, images)
  }

  const existingFolders = useStore.getState().library.folders
  const mergedFolders: Folder[] = [...existingFolders]
  for (const [folderPath, images] of importedByFolder) {
    const id = folderPath === 'Finder Drop' ? 'finder-drop' : `imported-${folderPath}`
    const index = mergedFolders.findIndex((folder) => folder.id === id)
    if (index >= 0) {
      const existing = mergedFolders[index]
      const existingIds = new Set(existing.images.map((img) => img.id))
      mergedFolders[index] = { ...existing, images: [...existing.images, ...images.filter((img) => !existingIds.has(img.id))], loaded: true }
    } else {
      mergedFolders.push({ id, name: folderPath, handle: null, images, loaded: true })
    }
  }

  useStore.setState((state) => ({
    library: { ...state.library, folders: mergedFolders },
    canvas: parsed.canvas,
    ui: { ...state.ui, selectedIds: [], draggingIds: [], undoStack: [], redoStack: [] },
  }))
}

export function pickBackupFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null))
    input.addEventListener('cancel', () => resolve(null))
    input.click()
  })
}
