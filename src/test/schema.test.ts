import { describe, expect, it } from 'vitest'
import { normalizeCanvasData, parsePhotoTableBackup } from '../lib/schema'

const validCanvas = {
  photos: [
    {
      id: 'p1',
      libraryImageId: 'img1',
      filenameHint: 'IMG_001.jpg',
      x: 10,
      y: 20,
      rotation: 0,
      scale: 1,
      zIndex: 1,
      clumpId: null,
    },
  ],
  clumps: [{ id: 'c1', name: 'Clump 1', color: '#E74C3C' }],
  clumpCounter: 1,
  viewport: { x: 0, y: 0, zoom: 1 },
}

describe('normalizeCanvasData', () => {
  it('normalizes a valid canvas', () => {
    expect(normalizeCanvasData(validCanvas)).toEqual({ schemaVersion: 1, ...validCanvas })
  })

  it('rejects malformed photos', () => {
    expect(normalizeCanvasData({ ...validCanvas, photos: [{ id: 'p1' }] })).toBeNull()
  })

  it('rejects invalid viewport zoom', () => {
    expect(normalizeCanvasData({ ...validCanvas, viewport: { x: 0, y: 0, zoom: 0 } })).toBeNull()
  })
})

describe('parsePhotoTableBackup', () => {
  it('accepts version 1 backups with valid canvas data', () => {
    const backup = parsePhotoTableBackup({
      version: 1,
      exportedAt: '2026-05-02T00:00:00.000Z',
      activeProjectId: 'proj-1',
      canvas: validCanvas,
      importedImages: [
        {
          id: 'img1',
          filename: 'IMG_001.jpg',
          folderPath: 'Finder Drop',
          dataUrl: 'data:image/jpeg;base64,abc',
        },
      ],
    })

    expect(backup.canvas.photos).toHaveLength(1)
    expect(backup.importedImages).toHaveLength(1)
  })

  it('rejects unsupported backup versions', () => {
    expect(() => parsePhotoTableBackup({ version: 2, canvas: validCanvas })).toThrow('Unsupported')
  })
})
