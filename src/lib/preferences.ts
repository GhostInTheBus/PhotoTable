export type ThumbDensity = 'small' | 'medium' | 'large'

const BACKUP_NUDGE_KEY = 'phototable-backup-nudge-seen'
const LEGEND_DISMISSED_KEY = 'phototable-legend-dismissed'
const SIDEBAR_WIDTH_KEY = 'phototable-sidebar-width'
const THUMB_DENSITY_KEY = 'phototable-thumb-density'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Preference writes are best effort; the app should still be usable.
  }
}

export function hasSeenBackupNudge(): boolean {
  return read(BACKUP_NUDGE_KEY) === '1'
}

export function markBackupNudgeSeen(): void {
  write(BACKUP_NUDGE_KEY, '1')
}

export function isLegendDismissed(): boolean {
  return read(LEGEND_DISMISSED_KEY) === '1'
}

export function dismissLegend(): void {
  write(LEGEND_DISMISSED_KEY, '1')
}

export function getThumbDensity(): ThumbDensity {
  const saved = read(THUMB_DENSITY_KEY)
  return saved === 'small' || saved === 'large' ? saved : 'medium'
}

export function setThumbDensityPreference(value: ThumbDensity): void {
  write(THUMB_DENSITY_KEY, value)
}

export function getSidebarWidth(): number {
  const saved = read(SIDEBAR_WIDTH_KEY)
  if (!saved) return 224
  const parsed = parseInt(saved, 10)
  return Number.isNaN(parsed) ? 224 : Math.max(160, Math.min(520, parsed))
}

export function setSidebarWidthPreference(value: number): void {
  write(SIDEBAR_WIDTH_KEY, String(Math.max(160, Math.min(520, value))))
}
