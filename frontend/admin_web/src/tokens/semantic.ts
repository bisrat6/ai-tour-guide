/**
 * Semantic token layer. Every entry names a primitive step for each plane —
 * never a raw colour. The tenant column is the default (`:root` and
 * `[data-plane="tenant"]`); the control column is the `[data-plane="control"]`
 * override block.
 *
 * Rows marked `plane-theming` are transcribed from the "Plane theming" table in
 * admin-web-design.md section 5. Rows marked `derived` come from the status
 * primitive table, its dark-plane note, and the scope and elevation rules in
 * the same section.
 *
 * src/styles/semantic.css is generated from this file by `npm run tokens:build`.
 */

import { primitiveRef, primitiveValue, toCssVar } from './primitives.ts'

export type Plane = 'tenant' | 'control'

export const planes: Plane[] = ['tenant', 'control']

export const planeLabels: Record<Plane, string> = {
  tenant: 'Tenant plane (light)',
  control: 'Control plane (dark)',
}

export type SemanticToken = {
  /** Spec name, e.g. `surface.canvas`. */
  name: string
  cssVar: string
  /** Primitive name used on the tenant plane. */
  tenant: string
  /** Primitive name used on the control plane. */
  control: string
  source: 'plane-theming' | 'derived'
  /** Surface a translucent value is painted over, for contrast measurement. */
  over?: string
  note?: string
}

export type SemanticGroup = {
  title: string
  tokens: SemanticToken[]
}

type TokenInput = Omit<SemanticToken, 'cssVar'>

function token(input: TokenInput): SemanticToken {
  return { ...input, cssVar: toCssVar(input.name) }
}

export const semanticGroups: SemanticGroup[] = [
  {
    title: 'Surface',
    tokens: [
      token({ name: 'surface.canvas', tenant: 'zinc.100', control: 'zinc.950', source: 'plane-theming' }),
      token({ name: 'surface.raised', tenant: 'white', control: 'zinc.900', source: 'plane-theming' }),
      token({ name: 'surface.sunken', tenant: 'zinc.200', control: 'zinc.800', source: 'plane-theming' }),
      token({
        name: 'surface.sidebar',
        tenant: 'zinc.900',
        control: 'zinc.950',
        source: 'plane-theming',
        note: 'the tenant rail is dark on a light plane: a shell signal, not a plane signal',
      }),
      token({ name: 'surface.sidebarEdge', tenant: 'zinc.800', control: 'zinc.800', source: 'plane-theming' }),
      token({ name: 'surface.overlay', tenant: 'white', control: 'zinc.900', source: 'plane-theming' }),
      token({
        name: 'surface.scrim',
        tenant: 'zinc.950/50',
        control: 'zinc.950/50',
        source: 'derived',
        over: 'surface.canvas',
        note: 'overlays that need more separation take a scrim, not a deeper shadow',
      }),
      token({
        name: 'surface.hover',
        tenant: 'zinc.100',
        control: 'zinc.800',
        source: 'derived',
        note: 'row hover, ghost buttons, menu options and tab hover',
      }),
      token({
        name: 'surface.shimmer',
        tenant: 'zinc.300',
        control: 'zinc.700',
        source: 'derived',
        note: 'skeleton sheen highlight',
      }),
    ],
  },
  {
    title: 'Content',
    tokens: [
      token({ name: 'content.primary', tenant: 'zinc.900', control: 'zinc.50', source: 'plane-theming' }),
      token({ name: 'content.secondary', tenant: 'zinc.600', control: 'zinc.400', source: 'plane-theming' }),
      token({
        name: 'content.muted',
        tenant: 'zinc.500',
        control: 'zinc.500',
        source: 'plane-theming',
        note: 'same on both planes; large text, icons and disabled labels only, never body copy',
      }),
      token({ name: 'content.onSidebar', tenant: 'zinc.50', control: 'zinc.50', source: 'plane-theming' }),
      token({
        name: 'content.onSidebarMuted',
        tenant: 'zinc.400',
        control: 'zinc.400',
        source: 'plane-theming',
        note: 'eyebrow and label text on a dark rail uses this, not content.secondary',
      }),
    ],
  },
  {
    title: 'Border',
    tokens: [
      token({
        name: 'border.hairline',
        tenant: 'zinc.200',
        control: 'zinc.800',
        source: 'plane-theming',
        note: 'decorative row and card edges, where the surface change already does the work',
      }),
      token({
        name: 'border.control',
        tenant: 'zinc.500',
        control: 'zinc.500',
        source: 'plane-theming',
        note: 'input, chip and secondary-button edges; must clear 3:1 against their surface',
      }),
    ],
  },
  {
    title: 'Accent',
    tokens: [
      token({
        name: 'accent.mark',
        tenant: 'emerald.600',
        control: 'emerald.500',
        source: 'plane-theming',
        note: 'emerald steps brighter on dark to hold separation',
      }),
      token({ name: 'accent.fill', tenant: 'emerald.700', control: 'emerald.500', source: 'plane-theming' }),
      token({ name: 'accent.onFill', tenant: 'white', control: 'emerald.950', source: 'plane-theming' }),
      token({
        name: 'accent.tint',
        tenant: 'emerald.100',
        control: 'emerald.500/16',
        source: 'plane-theming',
        over: 'surface.raised',
      }),
      token({ name: 'accent.onTint', tenant: 'emerald.800', control: 'emerald.500', source: 'plane-theming' }),
    ],
  },
  {
    title: 'Action',
    tokens: [
      token({
        name: 'action.primary.fill',
        tenant: 'zinc.900',
        control: 'zinc.50',
        source: 'plane-theming',
        note: 'primary buttons are near-black, not emerald',
      }),
      token({ name: 'action.primary.text', tenant: 'white', control: 'zinc.950', source: 'plane-theming' }),
      token({
        name: 'action.primary.fillHover',
        tenant: 'zinc.800',
        control: 'zinc.200',
        source: 'derived',
        note: 'hover step for the near-black / near-white primary fill',
      }),
      token({ name: 'action.secondary.fill', tenant: 'white', control: 'zinc.900', source: 'plane-theming' }),
      token({ name: 'action.secondary.text', tenant: 'zinc.900', control: 'zinc.50', source: 'plane-theming' }),
      token({ name: 'action.secondary.border', tenant: 'zinc.500', control: 'zinc.500', source: 'plane-theming' }),
      token({
        name: 'action.secondary.fillHover',
        tenant: 'zinc.100',
        control: 'zinc.800',
        source: 'derived',
        note: 'same value as surface.hover; kept separate so a later divergence is a one-line change',
      }),
      token({ name: 'action.danger.fill', tenant: 'red.600', control: 'red.600', source: 'plane-theming' }),
      token({ name: 'action.danger.text', tenant: 'white', control: 'white', source: 'plane-theming' }),
      token({
        name: 'action.danger.fillHover',
        tenant: 'red.800',
        control: 'red.800',
        source: 'derived',
        note: 'darker danger fill for hover; white label clears AA',
      }),
    ],
  },
  {
    title: 'Feedback',
    tokens: [
      token({ name: 'feedback.success', tenant: 'emerald.600', control: 'emerald.500', source: 'plane-theming' }),
      token({ name: 'feedback.danger', tenant: 'red.600', control: 'red.400', source: 'plane-theming' }),
      token({ name: 'feedback.warning', tenant: 'amber.600', control: 'amber.400', source: 'plane-theming' }),
      token({ name: 'feedback.neutral', tenant: 'zinc.500', control: 'zinc.400', source: 'plane-theming' }),
    ],
  },
  {
    title: 'Selection and focus',
    tokens: [
      token({
        name: 'selection.row',
        tenant: 'emerald.100',
        control: 'emerald.500/16',
        source: 'plane-theming',
        over: 'surface.raised',
      }),
      token({
        name: 'focus.ring',
        tenant: 'emerald.600',
        control: 'emerald.600',
        source: 'plane-theming',
        note: 'the same ring on both planes; it clears 3:1 against every surface',
      }),
    ],
  },
  {
    title: 'Status tint and label',
    tokens: [
      token({
        name: 'status.success.tint',
        tenant: 'emerald.100',
        control: 'emerald.500/16',
        source: 'derived',
        over: 'surface.raised',
      }),
      token({ name: 'status.success.onTint', tenant: 'emerald.800', control: 'emerald.500', source: 'derived' }),
      token({
        name: 'status.danger.tint',
        tenant: 'red.100',
        control: 'red.400/16',
        source: 'derived',
        over: 'surface.raised',
      }),
      token({ name: 'status.danger.onTint', tenant: 'red.800', control: 'red.400', source: 'derived' }),
      token({
        name: 'status.warning.tint',
        tenant: 'amber.100',
        control: 'amber.400/16',
        source: 'derived',
        over: 'surface.raised',
      }),
      token({ name: 'status.warning.onTint', tenant: 'amber.800', control: 'amber.400', source: 'derived' }),
      token({
        name: 'status.neutral.tint',
        tenant: 'zinc.100',
        control: 'zinc.400/16',
        source: 'derived',
        over: 'surface.raised',
      }),
      token({ name: 'status.neutral.onTint', tenant: 'zinc.600', control: 'zinc.400', source: 'derived' }),
    ],
  },
  {
    title: 'Scope band — one use across the whole product',
    tokens: [
      token({ name: 'scope.band.fill', tenant: 'scope.amber', control: 'scope.amber', source: 'derived' }),
      token({ name: 'scope.band.text', tenant: 'scope.onAmber', control: 'scope.onAmber', source: 'derived' }),
      token({
        name: 'scope.band.edge',
        tenant: 'scope.amberEdge',
        control: 'scope.amberEdge',
        source: 'derived',
        note: 'the amber fill alone is 1.95:1 on the light canvas, so the band keeps a hard edge',
      }),
    ],
  },
]

export const semanticTokens: SemanticToken[] = semanticGroups.flatMap((group) => group.tokens)

const semanticByName = new Map(semanticTokens.map((entry) => [entry.name, entry]))

export function semanticToken(name: string): SemanticToken {
  const found = semanticByName.get(name)
  if (!found) throw new Error(`Unknown semantic token: ${name}`)
  return found
}

/** The primitive a semantic token resolves to on a plane, e.g. `zinc.100`. */
export function semanticPrimitive(name: string, plane: Plane): string {
  return semanticToken(name)[plane]
}

/** The resolved colour of a semantic token on a plane, e.g. `#F4F4F5`. */
export function semanticValue(name: string, plane: Plane): string {
  return primitiveValue(semanticPrimitive(name, plane))
}

/** Composite effects: values that reference primitives but are not single colours. */
export type EffectToken = {
  name: string
  cssVar: string
  tenant: string
  control: string
  note?: string
}

export const effectTokens: EffectToken[] = [
  {
    name: 'elevation.flat',
    cssVar: '--elevation-flat',
    tenant: 'none',
    control: 'none',
    note: 'a hairline border alone',
  },
  {
    name: 'elevation.soft',
    cssVar: '--elevation-soft',
    tenant: `0 1px 2px ${primitiveRef('zinc.950/05')}, 0 8px 24px ${primitiveRef('zinc.950/08')}`,
    control: `0 1px 2px ${primitiveRef('zinc.950/40')}, 0 8px 24px ${primitiveRef('zinc.950/60')}`,
    note: 'hairline border plus a very soft shadow; never a heavy drop shadow',
  },
  {
    name: 'elevation.pressInset',
    cssVar: '--elevation-press-inset',
    tenant: `inset 0 1px 2px ${primitiveRef('zinc.950/08')}`,
    control: `inset 0 1px 2px ${primitiveRef('zinc.950/40')}`,
    note: 'shared pressed treatment for controls; active gets inset, not a third fill step',
  },
]
