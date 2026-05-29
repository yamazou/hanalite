/** Normalize user/API color to #RRGGBB or empty (no color). */
export function normalizeItemTypColor(value: string | null | undefined): string {
  if (value == null) return ''
  const s = value.trim().replace(/^#/, '')
  if (!s) return ''
  const withHash = `#${s}`
  if (!/^#[0-9A-Fa-f]{6}$/.test(withHash)) return ''
  return withHash.toUpperCase()
}

/** Grid edit / display: 6-digit hex without #. */
export function itemTypColorToDisplay(value: string | null | undefined): string {
  return normalizeItemTypColor(value).slice(1)
}

export function itemTextColorStyle(
  color: string | undefined
): { color: string } | undefined {
  return color ? { color, fontWeight: 'normal' as const } : undefined
}
