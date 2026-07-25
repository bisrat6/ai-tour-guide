/**
 * Colour helpers shared by the token source and the contrast audit.
 * Pure functions only: no DOM, no Node APIs, so both the browser preview and
 * the build scripts can use them.
 */

export type Rgb = { r: number; g: number; b: number }
export type Rgba = Rgb & { a: number }

const HEX_PATTERN = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const RGB_PATTERN = /^rgba?\(([^)]+)\)$/i

function expandShortHex(hex: string): string {
  return hex
    .split('')
    .map((char) => char + char)
    .join('')
}

/** Parses `#RGB`, `#RGBA`, `#RRGGBB`, `#RRGGBBAA`, `rgb()` and `rgba()`. */
export function parseColor(input: string): Rgba {
  const value = input.trim()

  if (HEX_PATTERN.test(value)) {
    const body = value.slice(1)
    const full = body.length <= 4 ? expandShortHex(body) : body
    const channel = (index: number) => Number.parseInt(full.slice(index * 2, index * 2 + 2), 16)
    return {
      r: channel(0),
      g: channel(1),
      b: channel(2),
      a: full.length === 8 ? channel(3) / 255 : 1,
    }
  }

  const rgbMatch = RGB_PATTERN.exec(value)
  if (rgbMatch) {
    const parts = rgbMatch[1].split(/[\s,/]+/).filter(Boolean)
    if (parts.length < 3) throw new Error(`Cannot parse colour: ${input}`)
    const channel = (part: string) =>
      part.endsWith('%') ? (Number.parseFloat(part) / 100) * 255 : Number.parseFloat(part)
    const alphaPart = parts[3]
    return {
      r: channel(parts[0]),
      g: channel(parts[1]),
      b: channel(parts[2]),
      a: alphaPart === undefined
        ? 1
        : alphaPart.endsWith('%')
          ? Number.parseFloat(alphaPart) / 100
          : Number.parseFloat(alphaPart),
    }
  }

  throw new Error(`Cannot parse colour: ${input}`)
}

/** Writes an rgba() string for a hex colour at a given alpha. */
export function alpha(hex: string, amount: number): string {
  const { r, g, b } = parseColor(hex)
  return `rgba(${r}, ${g}, ${b}, ${amount})`
}

/** Flattens a translucent colour onto an opaque backdrop. */
export function composite(foreground: Rgba, backdrop: Rgb): Rgb {
  const mix = (front: number, back: number) => front * foreground.a + back * (1 - foreground.a)
  return {
    r: mix(foreground.r, backdrop.r),
    g: mix(foreground.g, backdrop.g),
    b: mix(foreground.b, backdrop.b),
  }
}

/** WCAG 2.1 relative luminance. */
export function relativeLuminance(color: Rgb): number {
  const linear = (channel: number) => {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * linear(color.r) + 0.7152 * linear(color.g) + 0.0722 * linear(color.b)
}

/**
 * WCAG 2.1 contrast ratio. Translucent inputs are flattened first: the
 * foreground onto the resolved background, the background onto `backdrop`.
 */
export function contrastRatio(foreground: string, background: string, backdrop?: string): number {
  const backdropColor = backdrop === undefined ? undefined : parseColor(backdrop)
  const rawBackground = parseColor(background)
  const solidBackground =
    rawBackground.a === 1 || backdropColor === undefined
      ? { r: rawBackground.r, g: rawBackground.g, b: rawBackground.b }
      : composite(rawBackground, backdropColor)

  const rawForeground = parseColor(foreground)
  const solidForeground =
    rawForeground.a === 1 ? rawForeground : composite(rawForeground, solidBackground)

  const lighter = Math.max(relativeLuminance(solidForeground), relativeLuminance(solidBackground))
  const darker = Math.min(relativeLuminance(solidForeground), relativeLuminance(solidBackground))
  return (lighter + 0.05) / (darker + 0.05)
}

/** Contrast ratio rounded the way the audit table reports it. */
export function roundRatio(ratio: number): number {
  return Math.round(ratio * 100) / 100
}
