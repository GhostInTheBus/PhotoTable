const trackedUrls = new Set<string>()

export function trackObjectUrl(url: string): string {
  if (url.startsWith('blob:')) trackedUrls.add(url)
  return url
}

export function revokeObjectUrl(url: string | undefined): void {
  if (!url || !trackedUrls.has(url)) return
  URL.revokeObjectURL(url)
  trackedUrls.delete(url)
}

export function revokeObjectUrls(urls: Iterable<string | undefined>): void {
  for (const url of urls) revokeObjectUrl(url)
}

export function revokeAllObjectUrls(): void {
  for (const url of trackedUrls) URL.revokeObjectURL(url)
  trackedUrls.clear()
}
