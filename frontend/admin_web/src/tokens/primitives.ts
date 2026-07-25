/**
 * Primitive token layer — the only file in the project that may hold a raw
 * colour value. Values are transcribed from admin-web-design.md section 5
 * ("Visual Language and Tokens"). Every semantic and component token resolves
 * to a step named here.
 *
 * src/styles/primitives.css is generated from this file by `npm run tokens:build`.
 */

import { alpha } from './color.ts'

export type Primitive = {
  /** Spec name, e.g. `zinc.950`. */
  name: string
  /** CSS custom property, e.g. `--zinc-950`. */
  cssVar: string
  value: string
  note?: string
}

export type PrimitiveGroup = {
  title: string
  primitives: Primitive[]
}

/** `surface.canvas` -> `--surface-canvas`, `emerald.500/16` -> `--emerald-500-a16`. */
export function toCssVar(name: string): string {
  return `--${name.replace(/\./g, '-').replace(/\//g, '-a').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`
}

function primitive(name: string, value: string, note?: string): Primitive {
  return { name, cssVar: toCssVar(name), value, ...(note === undefined ? {} : { note }) }
}

const ZINC = {
  950: '#09090B',
  900: '#18181B',
  800: '#27272A',
  700: '#3F3F46',
  600: '#52525B',
  500: '#71717A',
  400: '#A1A1AA',
  300: '#D4D4D8',
  200: '#E4E4E7',
  100: '#F4F4F5',
  50: '#FAFAFA',
} as const

const EMERALD = {
  950: '#022C22',
  800: '#065F46',
  700: '#047857',
  600: '#059669',
  500: '#10B981',
  100: '#D1FAE5',
} as const

const RED = {
  800: '#991B1B',
  600: '#DC2626',
  400: '#F87171',
  100: '#FEE2E2',
} as const

const AMBER = {
  800: '#92400E',
  600: '#D97706',
  400: '#FBBF24',
  100: '#FEF3C7',
} as const

const WHITE = '#FFFFFF'

/** The 16% dark-plane tint strength named in the status table's dark-plane note. */
const TINT_ALPHA = 0.16

export const primitiveGroups: PrimitiveGroup[] = [
  {
    title: 'Neutrals — the zinc scale',
    primitives: [
      primitive('zinc.950', ZINC[950]),
      primitive('zinc.900', ZINC[900]),
      primitive('zinc.800', ZINC[800]),
      primitive('zinc.700', ZINC[700]),
      primitive('zinc.600', ZINC[600]),
      primitive('zinc.500', ZINC[500]),
      primitive('zinc.400', ZINC[400]),
      primitive('zinc.300', ZINC[300]),
      primitive('zinc.200', ZINC[200]),
      primitive('zinc.100', ZINC[100]),
      primitive('zinc.50', ZINC[50]),
      primitive('white', WHITE),
    ],
  },
  {
    title: 'Emerald accent',
    primitives: [
      primitive('emerald.950', EMERALD[950]),
      primitive('emerald.800', EMERALD[800]),
      primitive('emerald.700', EMERALD[700]),
      primitive('emerald.600', EMERALD[600]),
      primitive('emerald.500', EMERALD[500]),
      primitive('emerald.100', EMERALD[100]),
    ],
  },
  {
    title: 'Status — danger, warning, and the neutral draft state reuse zinc',
    primitives: [
      primitive('red.800', RED[800], 'text on the danger tint'),
      primitive('red.600', RED[600], 'danger hue, light plane'),
      primitive('red.400', RED[400], 'danger hue, dark plane'),
      primitive('red.100', RED[100], 'danger tint, light plane'),
      primitive('amber.800', AMBER[800], 'text on the warning tint'),
      primitive('amber.600', AMBER[600], 'warning hue, light plane'),
      primitive('amber.400', AMBER[400], 'warning hue, dark plane'),
      primitive('amber.100', AMBER[100], 'warning tint, light plane'),
    ],
  },
  {
    title: 'Scope — the operator-inside-tenant band, and nothing else',
    primitives: [
      primitive('scope.amber', '#F59E0B', 'the scoped-in band fill'),
      primitive('scope.onAmber', '#09090B', 'text and icons on that band'),
      primitive('scope.amberEdge', '#92400E', 'the 2px bottom edge, on both planes'),
    ],
  },
  {
    title: 'Translucent steps — derived from the scales above, never typed by hand',
    primitives: [
      primitive('emerald.500/16', alpha(EMERALD[500], TINT_ALPHA), 'dark-plane accent tint and row selection'),
      primitive('red.400/16', alpha(RED[400], TINT_ALPHA), 'dark-plane danger tint'),
      primitive('amber.400/16', alpha(AMBER[400], TINT_ALPHA), 'dark-plane warning tint'),
      primitive('zinc.400/16', alpha(ZINC[400], TINT_ALPHA), 'dark-plane neutral tint'),
      primitive('zinc.950/05', alpha(ZINC[950], 0.05), 'hairline shadow, light plane'),
      primitive('zinc.950/08', alpha(ZINC[950], 0.08), 'soft ambient shadow, light plane'),
      primitive('zinc.950/40', alpha(ZINC[950], 0.4), 'hairline shadow, dark plane'),
      primitive('zinc.950/50', alpha(ZINC[950], 0.5), 'overlay scrim'),
      primitive('zinc.950/60', alpha(ZINC[950], 0.6), 'soft ambient shadow, dark plane'),
    ],
  },
]

export const primitives: Primitive[] = primitiveGroups.flatMap((group) => group.primitives)

const primitivesByName = new Map(primitives.map((entry) => [entry.name, entry]))

export function primitiveByName(name: string): Primitive {
  const found = primitivesByName.get(name)
  if (!found) throw new Error(`Unknown primitive: ${name}`)
  return found
}

/** The resolved value of a primitive, e.g. `#09090B`. */
export function primitiveValue(name: string): string {
  return primitiveByName(name).value
}

/** A `var()` reference to a primitive, for use in the semantic layer. */
export function primitiveRef(name: string): string {
  return `var(${primitiveByName(name).cssVar})`
}
