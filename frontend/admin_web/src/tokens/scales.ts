/**
 * Non-colour scales: type, spacing rhythm, interactive target, radius and
 * motion. Transcribed from the Typography, "Radius and elevation", Focus and
 * Motion rules in admin-web-design.md sections 5 and 9.
 *
 * src/styles/scales.css is generated from this file by `npm run tokens:build`.
 */

import { toCssVar } from './primitives.ts'

export type ScaleToken = {
  name: string
  cssVar: string
  value: string
  note?: string
}

function scale(name: string, value: string, note?: string): ScaleToken {
  return { name, cssVar: toCssVar(name), value, ...(note === undefined ? {} : { note }) }
}

export const fontTokens: ScaleToken[] = [
  scale(
    'font.ui',
    "'Inter Variable', 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    'the workhorse: navigation, tables, forms, controls, titles, figures',
  ),
  scale(
    'font.museum',
    "'Cormorant Garamond', 'Iowan Old Style', Georgia, 'Times New Roman', serif",
    'museum names only, applied through the .museum-name utility',
  ),
]

export const weightTokens: ScaleToken[] = [
  scale('weight.regular', '400'),
  scale('weight.medium', '500'),
  scale('weight.semibold', '600'),
  scale('weight.bold', '700'),
]

export type TypeStep = {
  /** Token stem, e.g. `text.body` produces `--text-body-size`. */
  name: string
  label: string
  size: string
  lineHeight: string
  weight: string
  tracking: string
  transform?: 'uppercase'
  use: string
}

export const typeSteps: TypeStep[] = [
  {
    name: 'text.display',
    label: 'Display',
    size: '30px',
    lineHeight: '36px',
    weight: '600',
    tracking: '-0.02em',
    use: 'the single largest figure on a screen',
  },
  {
    name: 'text.title',
    label: 'Title',
    size: '24px',
    lineHeight: '32px',
    weight: '600',
    tracking: '-0.02em',
    use: 'page titles',
  },
  {
    name: 'text.subtitle',
    label: 'Subtitle',
    size: '20px',
    lineHeight: '28px',
    weight: '600',
    tracking: '-0.01em',
    use: 'section and panel headings',
  },
  {
    name: 'text.lead',
    label: 'Lead',
    size: '18px',
    lineHeight: '26px',
    weight: '500',
    tracking: '0',
    use: 'large text; at 600 weight this is the WCAG large-text floor',
  },
  {
    name: 'text.bodyLarge',
    label: 'Body large',
    size: '16px',
    lineHeight: '24px',
    weight: '400',
    tracking: '0',
    use: 'form values and reading copy',
  },
  {
    name: 'text.body',
    label: 'Body',
    size: '14px',
    lineHeight: '20px',
    weight: '400',
    tracking: '0',
    use: 'the default: table cells, navigation, controls',
  },
  {
    name: 'text.caption',
    label: 'Caption',
    size: '12px',
    lineHeight: '16px',
    weight: '500',
    tracking: '0',
    use: 'meta text and helper text; nothing visible goes below this',
  },
  {
    name: 'text.columnHeader',
    label: 'Column header',
    size: '12px',
    lineHeight: '16px',
    weight: '600',
    tracking: '0.08em',
    transform: 'uppercase',
    use: 'table column headers and eyebrows',
  },
]

export const typeTokens: ScaleToken[] = typeSteps.flatMap((step) => {
  const tokens = [
    scale(`${step.name}.size`, step.size),
    scale(`${step.name}.line`, step.lineHeight),
    scale(`${step.name}.weight`, step.weight),
    scale(`${step.name}.tracking`, step.tracking),
  ]
  return tokens
})

export const spacingTokens: ScaleToken[] = [
  scale('space.0-5', '4px', 'half step, for tight icon and label gaps only'),
  scale('space.1', '8px', 'the rhythm unit'),
  scale('space.2', '16px'),
  scale('space.3', '24px'),
  scale('space.4', '32px'),
  scale('space.5', '40px'),
  scale('space.6', '48px'),
  scale('space.8', '64px'),
  scale('space.10', '80px'),
]

export const sizingTokens: ScaleToken[] = [
  scale('target.min', '44px', 'minimum interactive target on every control'),
]

export const borderWidthTokens: ScaleToken[] = [
  scale('border.hairlineWidth', '1px', 'row, card and panel edges'),
  scale('border.scopeEdgeWidth', '2px', 'the scoped-in band keeps a hard bottom edge on both planes'),
]

export const radiusTokens: ScaleToken[] = [
  scale('radius.surface', '8px', 'cards, panels, buttons, peek panel, bulk bar'),
  scale('radius.control', '6px', 'filter chips, inputs, selects'),
  scale('radius.round', '999px', 'avatars and status pills'),
]

export const focusTokens: ScaleToken[] = [
  scale('focus.width', '2px'),
  scale('focus.offset', '2px', 'the gap shows the underlying surface'),
]

export const motionTokens: ScaleToken[] = [
  scale('motion.view', '350ms', 'view transitions'),
  scale('motion.inline', '250ms', 'inline feedback'),
  scale('motion.ease', 'cubic-bezier(0.2, 0, 0, 1)'),
]

export type ScaleGroup = {
  title: string
  tokens: ScaleToken[]
}

export const scaleGroups: ScaleGroup[] = [
  { title: 'Font families', tokens: fontTokens },
  { title: 'Font weights', tokens: weightTokens },
  { title: 'Type scale', tokens: typeTokens },
  { title: 'Spacing rhythm', tokens: spacingTokens },
  { title: 'Interactive target', tokens: sizingTokens },
  { title: 'Border widths', tokens: borderWidthTokens },
  { title: 'Radius', tokens: radiusTokens },
  { title: 'Focus ring', tokens: focusTokens },
  { title: 'Motion', tokens: motionTokens },
]

export const scaleTokens: ScaleToken[] = scaleGroups.flatMap((group) => group.tokens)

const scalesByName = new Map(scaleTokens.map((entry) => [entry.name, entry]))

export function scaleToken(name: string): ScaleToken {
  const found = scalesByName.get(name)
  if (!found) throw new Error(`Unknown scale token: ${name}`)
  return found
}

export function scaleRef(name: string): string {
  return `var(${scaleToken(name).cssVar})`
}

export function scaleValue(name: string): string {
  return scaleToken(name).value
}
