// src/store/types.ts
export interface LibraryImage {
  id: string
  filename: string
  folderPath: string
  fileHandle: FileSystemFileHandle | null
  thumbnailUrl: string
  source?: 'folder-handle' | 'imported-blob'
  width?: number
  height?: number
}

export interface Folder {
  id: string
  name: string
  handle: FileSystemDirectoryHandle | null
  images: LibraryImage[]
  loaded: boolean
}

export interface PlacedPhoto {
  id: string
  libraryImageId: string
  filenameHint?: string
  x: number
  y: number
  rotation: number
  scale: number
  zIndex: number
  clumpId: string | null
}

export interface Viewport {
  x: number
  y: number
  zoom: number
}

export const CLUMP_COLORS = [
  '#E74C3C', // red
  '#3498DB', // blue
  '#2ECC71', // green
  '#F39C12', // orange
  '#9B59B6', // purple
  '#1ABC9C', // teal
  '#E91E63', // pink
  '#FF9800', // amber
]

export interface Clump {
  id: string
  name: string   // "Clump 1", "Clump 2", etc.
  color: string  // hex from CLUMP_COLORS
}

export interface Project {
  id: string
  name: string
  createdAt: number
}
