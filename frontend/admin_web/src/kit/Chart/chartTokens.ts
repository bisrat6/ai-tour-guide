/** Parses a resolved CSS colour string and returns it at the given alpha. */
export function colorWithAlpha(color: string, alpha: number): string {
  const trimmed = color.trim()
  if (trimmed.length === 0) return trimmed

  const hex = trimmed.match(/^#([0-9a-f]{3,8})$/i)
  if (hex !== null) {
    const raw = hex[1]
    const expanded =
      raw.length === 3
        ? raw
            .split('')
            .map((digit) => digit + digit)
            .join('')
        : raw.slice(0, 6)
    const r = Number.parseInt(expanded.slice(0, 2), 16)
    const g = Number.parseInt(expanded.slice(2, 4), 16)
    const b = Number.parseInt(expanded.slice(4, 6), 16)
    // token-usage-allow: raw-color — alpha derived from a resolved component token, not a fixed hue
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  const rgb = trimmed.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i)
  if (rgb !== null) {
    // token-usage-allow: raw-color — alpha derived from a resolved component token, not a fixed hue
    return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`
  }

  return trimmed
}

/** Parses `--motion-view` (e.g. "350ms") to a Chart.js duration number. */
export function parseMotionDuration(motionView: string, fallback = 350): number {
  const match = motionView.trim().match(/^([\d.]+)ms$/)
  if (match === null) return fallback
  return Number.parseFloat(match[1])
}

export const CHART_TOKEN_NAMES = [
  '--chart-series-primary',
  '--chart-series-comparison',
  '--chart-grid',
  '--chart-axis-text',
  '--chart-tooltip-surface',
  '--chart-tooltip-text',
  '--chart-tooltip-border',
  '--motion-view',
] as const

export type ChartTokenName = (typeof CHART_TOKEN_NAMES)[number]
