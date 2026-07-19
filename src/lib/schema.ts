import { Clump, PlacedPhoto, Project, Viewport } from '../store/types'

export const CANVAS_SCHEMA_VERSION = 1

export interface CanvasData {
  schemaVersion?: typeof CANVAS_SCHEMA_VERSION
  photos: PlacedPhoto[]
  clumps: Clump[]
  clumpCounter: number
  viewport: Viewport
}

export interface BackupImportedImage {
  id: string
  filename: string
  folderPath: string
  dataUrl: string
}

export interface PhotoTableBackup {
  version: 1
  exportedAt: string
  activeProjectId: string
  canvas: CanvasData
  importedImages: BackupImportedImage[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function normalizeViewport(value: unknown): Viewport | null {
  if (!isRecord(value)) return null
  const x = finiteNumber(value.x)
  const y = finiteNumber(value.y)
  const zoom = finiteNumber(value.zoom)
  if (x == null || y == null || zoom == null || zoom <= 0) return null
  return { x, y, zoom }
}

function normalizePhoto(value: unknown): PlacedPhoto | null {
  if (!isRecord(value)) return null
  const id = stringOrNull(value.id)
  const libraryImageId = stringOrNull(value.libraryImageId)
  const x = finiteNumber(value.x)
  const y = finiteNumber(value.y)
  const rotation = finiteNumber(value.rotation)
  const scale = finiteNumber(value.scale)
  const zIndex = finiteNumber(value.zIndex)
  const clumpId = value.clumpId === null || typeof value.clumpId === 'string' ? value.clumpId : null
  if (!id || !libraryImageId || x == null || y == null || rotation == null || scale == null || zIndex == null) {
    return null
  }
  if (scale <= 0) return null
  return {
    id,
    libraryImageId,
    filenameHint: typeof value.filenameHint === 'string' ? value.filenameHint : undefined,
    x,
    y,
    rotation,
    scale,
    zIndex,
    clumpId,
  }
}

function normalizeClump(value: unknown): Clump | null {
  if (!isRecord(value)) return null
  const id = stringOrNull(value.id)
  const name = stringOrNull(value.name)
  const color = stringOrNull(value.color)
  if (!id || !name || !color) return null
  return { id, name, color }
}

export function normalizeCanvasData(value: unknown): CanvasData | null {
  if (!isRecord(value)) return null
  const photos = Array.isArray(value.photos) ? value.photos.map(normalizePhoto) : null
  const clumps = Array.isArray(value.clumps) ? value.clumps.map(normalizeClump) : null
  const clumpCounter = finiteNumber(value.clumpCounter)
  const viewport = normalizeViewport(value.viewport)
  if (!photos || photos.some((photo) => photo === null)) return null
  if (!clumps || clumps.some((clump) => clump === null)) return null
  if (clumpCounter == null || viewport == null) return null
  return {
    schemaVersion: CANVAS_SCHEMA_VERSION,
    photos: photos as PlacedPhoto[],
    clumps: clumps as Clump[],
    clumpCounter,
    viewport,
  }
}

export function normalizeProjects(value: unknown): Project[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!isRecord(item)) return []
    const id = stringOrNull(item.id)
    const name = stringOrNull(item.name)
    const createdAt = finiteNumber(item.createdAt)
    return id && name && createdAt != null ? [{ id, name, createdAt }] : []
  })
}

export function parsePhotoTableBackup(value: unknown): PhotoTableBackup {
  if (!isRecord(value) || value.version !== 1) throw new Error('Unsupported PhotoTable backup')
  const canvas = normalizeCanvasData(value.canvas)
  if (!canvas) throw new Error('PhotoTable backup has invalid canvas data')
  const importedImages = Array.isArray(value.importedImages)
    ? value.importedImages.flatMap((item) => {
        if (!isRecord(item)) return []
        const id = stringOrNull(item.id)
        const filename = stringOrNull(item.filename)
        const folderPath = stringOrNull(item.folderPath)
        const dataUrl = stringOrNull(item.dataUrl)
        if (!id || !filename || !folderPath || !dataUrl?.startsWith('data:')) return []
        return [{ id, filename, folderPath, dataUrl }]
      })
    : []

  return {
    version: 1,
    exportedAt: typeof value.exportedAt === 'string' ? value.exportedAt : new Date().toISOString(),
    activeProjectId: typeof value.activeProjectId === 'string' ? value.activeProjectId : '',
    canvas,
    importedImages,
  }
}
