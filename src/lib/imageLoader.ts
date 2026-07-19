import { trackObjectUrl } from './objectUrls'

const THUMBNAIL_MAX_PX = 400

export async function createThumbnailFromBlob(file: Blob): Promise<{ url: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const originalUrl = URL.createObjectURL(file)
    img.onload = () => {
      const sourceWidth = img.naturalWidth || img.width
      const sourceHeight = img.naturalHeight || img.height
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, THUMBNAIL_MAX_PX / Math.max(sourceWidth, sourceHeight))
      canvas.width = sourceWidth * scale
      canvas.height = sourceHeight * scale
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(originalUrl)
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('toBlob failed')); return }
          resolve({ url: trackObjectUrl(URL.createObjectURL(blob)), width: sourceWidth, height: sourceHeight })
        },
        'image/jpeg',
        0.8
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(originalUrl)
      reject(new Error('Failed to load image'))
    }
    img.src = originalUrl
  })
}

export async function createThumbnailUrlFromBlob(file: Blob): Promise<string> {
  return (await createThumbnailFromBlob(file)).url
}

export async function createThumbnailUrl(
  fileHandle: FileSystemFileHandle
): Promise<string> {
  return createThumbnailUrlFromBlob(await fileHandle.getFile())
}

export async function createThumbnailFromFileHandle(
  fileHandle: FileSystemFileHandle
): Promise<{ url: string; width: number; height: number }> {
  return createThumbnailFromBlob(await fileHandle.getFile())
}

export async function createFullResUrl(
  fileHandle: FileSystemFileHandle
): Promise<string> {
  const file = await fileHandle.getFile()
  return trackObjectUrl(URL.createObjectURL(file))
}
