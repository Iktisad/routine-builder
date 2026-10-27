/** True on macOS/iOS, where modifier shortcuts use ⌘ rather than Ctrl. */
export function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  const data = (navigator as { userAgentData?: { platform?: string } }).userAgentData
  const platform = data?.platform ?? navigator.platform ?? navigator.userAgent ?? ''
  return /mac|iphone|ipad|ipod/i.test(platform)
}

/** "⌘Z" on Apple platforms, "Ctrl+Z" everywhere else. */
export function formatShortcut(key: string, apple: boolean): string {
  return apple ? `⌘${key.toUpperCase()}` : `Ctrl+${key.toUpperCase()}`
}

/** Convenience wrapper that reads the current platform. */
export function shortcut(key: string): string {
  return formatShortcut(key, isApplePlatform())
}

/** Fields where the browser's own undo/redo should win over ours. */
export function isTextEntry(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true
}
