/**
 * The Phase 1 contrast audit. Ratios are measured from the real token values
 * with the WCAG 2.1 relative-luminance formula, so the table cannot drift from
 * the tokens. Both the preview surface and `npm run audit:contrast` read this
 * module.
 */

import { contrastRatio, roundRatio } from '../tokens/color.ts'
import { primitiveValue } from '../tokens/primitives.ts'
import {
  planes,
  semanticPrimitive,
  semanticToken,
  semanticValue,
  type Plane,
} from '../tokens/semantic.ts'

export type Requirement = 'body' | 'large' | 'boundary' | 'decorative'

export const requirementMinimum: Record<Requirement, number | null> = {
  body: 4.5,
  large: 3,
  boundary: 3,
  decorative: null,
}

export const requirementLabel: Record<Requirement, string> = {
  body: '4.5:1 body text',
  large: '3:1 large text and marks',
  boundary: '3:1 interactive-control boundary',
  decorative: 'decorative, no minimum',
}

export type PairSpec = {
  /** Semantic token painted on top. */
  foreground: string
  /** Semantic token underneath. */
  background: string
  requirement: Requirement
  usage: string
  /** Present when the spec accepts the pair below its threshold, and says how. */
  mitigation?: string
  /** Restricts the pair to one plane. Both planes by default. */
  onlyPlane?: Plane
}

export type AuditSection = {
  title: string
  description: string
  pairs: PairSpec[]
}

const textOnSurface = (surface: string): PairSpec[] => [
  {
    foreground: 'content.primary',
    background: surface,
    requirement: 'body',
    usage: 'primary body copy',
  },
  {
    foreground: 'content.secondary',
    background: surface,
    requirement: 'body',
    usage: 'secondary body copy',
  },
  {
    foreground: 'content.muted',
    background: surface,
    requirement: 'large',
    usage: 'large text, icons and disabled labels only',
  },
]

const markOnSurface = (surface: string): PairSpec[] => [
  {
    foreground: 'accent.mark',
    background: surface,
    requirement: 'large',
    usage: 'spine segments, rules and chart series',
  },
  {
    foreground: 'feedback.success',
    background: surface,
    requirement: 'large',
    usage: 'ready and paid markers',
  },
  {
    foreground: 'feedback.danger',
    background: surface,
    requirement: 'large',
    usage: 'failed and cancelled markers',
  },
  {
    foreground: 'feedback.warning',
    background: surface,
    requirement: 'large',
    usage: 'pending markers',
  },
  {
    foreground: 'feedback.neutral',
    background: surface,
    requirement: 'large',
    usage: 'draft and not-started markers',
  },
]

export const auditSections: AuditSection[] = [
  {
    title: 'Text on plane surfaces',
    description: 'Every content role against every surface the plane paints.',
    pairs: [
      ...textOnSurface('surface.canvas'),
      ...textOnSurface('surface.raised'),
      ...textOnSurface('surface.sunken'),
      ...textOnSurface('surface.overlay'),
      {
        foreground: 'content.primary',
        background: 'surface.hover',
        requirement: 'body',
        usage: 'primary text on a hover fill',
      },
      {
        foreground: 'content.secondary',
        background: 'surface.hover',
        requirement: 'body',
        usage: 'secondary text on a hover fill',
      },
    ],
  },
  {
    title: 'Text on the sidebar rail',
    description:
      'The rail is dark on both planes, so it takes its own content roles rather than the plane roles.',
    pairs: [
      {
        foreground: 'content.onSidebar',
        background: 'surface.sidebar',
        requirement: 'body',
        usage: 'navigation labels and the signed-in user',
      },
      {
        foreground: 'content.onSidebarMuted',
        background: 'surface.sidebar',
        requirement: 'body',
        usage: 'eyebrows, counts and inactive labels',
      },
      {
        foreground: 'content.secondary',
        background: 'surface.sidebar',
        requirement: 'body',
        usage: 'not permitted on the rail; measured to show why',
        mitigation:
          'excluded by rule: rail labels use content.onSidebarMuted, which measures 6.91:1 on the tenant rail',
      },
    ],
  },
  {
    title: 'Text on fills, tints and selection',
    description: 'Every pair where a label sits on a filled control, a status tint or a selected row.',
    pairs: [
      {
        foreground: 'action.primary.text',
        background: 'action.primary.fill',
        requirement: 'body',
        usage: 'primary button label',
      },
      {
        foreground: 'action.secondary.text',
        background: 'action.secondary.fill',
        requirement: 'body',
        usage: 'secondary button label',
      },
      {
        foreground: 'action.danger.text',
        background: 'action.danger.fill',
        requirement: 'body',
        usage: 'destructive button label',
      },
      {
        foreground: 'action.primary.text',
        background: 'action.primary.fillHover',
        requirement: 'body',
        usage: 'primary button label on hover fill',
      },
      {
        foreground: 'action.secondary.text',
        background: 'action.secondary.fillHover',
        requirement: 'body',
        usage: 'secondary button label on hover fill',
      },
      {
        foreground: 'action.danger.text',
        background: 'action.danger.fillHover',
        requirement: 'body',
        usage: 'destructive button label on hover fill',
      },
      {
        foreground: 'accent.onFill',
        background: 'accent.fill',
        requirement: 'body',
        usage: 'label on a solid emerald fill',
      },
      {
        foreground: 'accent.onTint',
        background: 'accent.tint',
        requirement: 'body',
        usage: 'label on the emerald tint',
      },
      {
        foreground: 'status.success.onTint',
        background: 'status.success.tint',
        requirement: 'body',
        usage: 'ready badge label',
      },
      {
        foreground: 'status.danger.onTint',
        background: 'status.danger.tint',
        requirement: 'body',
        usage: 'failed badge label',
      },
      {
        foreground: 'status.warning.onTint',
        background: 'status.warning.tint',
        requirement: 'body',
        usage: 'pending badge label',
      },
      {
        foreground: 'status.neutral.onTint',
        background: 'status.neutral.tint',
        requirement: 'body',
        usage: 'draft badge label',
      },
      {
        foreground: 'content.primary',
        background: 'selection.row',
        requirement: 'body',
        usage: 'primary text in a selected table row',
      },
      {
        foreground: 'content.secondary',
        background: 'selection.row',
        requirement: 'body',
        usage: 'secondary text in a selected table row',
      },
      {
        foreground: 'scope.band.text',
        background: 'scope.band.fill',
        requirement: 'body',
        usage: 'the scoped-in band label and its exit control',
      },
    ],
  },
  {
    title: 'Marks and status hues on surfaces',
    description:
      'Status is never carried by hue alone, but the marker still has to be visible, so 3:1 applies.',
    pairs: [...markOnSurface('surface.canvas'), ...markOnSurface('surface.raised')],
  },
  {
    title: 'Control boundaries and the focus ring',
    description:
      'Input, chip and button edges, and the focus ring, must be identifiable against the surface behind them.',
    pairs: [
      {
        foreground: 'border.control',
        background: 'surface.canvas',
        requirement: 'boundary',
        usage: 'control edge on the canvas',
      },
      {
        foreground: 'border.control',
        background: 'surface.raised',
        requirement: 'boundary',
        usage: 'control edge on a raised surface',
      },
      {
        foreground: 'border.control',
        background: 'surface.sunken',
        requirement: 'boundary',
        usage: 'control edge on a sunken surface',
      },
      {
        foreground: 'action.secondary.border',
        background: 'action.secondary.fill',
        requirement: 'boundary',
        usage: 'secondary button edge',
      },
      {
        foreground: 'focus.ring',
        background: 'surface.canvas',
        requirement: 'boundary',
        usage: 'focus ring on the canvas',
      },
      {
        foreground: 'focus.ring',
        background: 'surface.raised',
        requirement: 'boundary',
        usage: 'focus ring on a raised surface',
      },
      {
        foreground: 'focus.ring',
        background: 'surface.sunken',
        requirement: 'boundary',
        usage: 'focus ring on a sunken surface',
      },
      {
        foreground: 'focus.ring',
        background: 'surface.hover',
        requirement: 'boundary',
        usage: 'focus ring on a hover fill',
      },
      {
        foreground: 'focus.ring',
        background: 'surface.sidebar',
        requirement: 'boundary',
        usage: 'focus ring on the rail',
      },
      {
        foreground: 'focus.ring',
        background: 'action.primary.fill',
        requirement: 'boundary',
        usage: 'focus ring against a primary button',
      },
      {
        foreground: 'accent.fill',
        background: 'surface.raised',
        requirement: 'boundary',
        usage: 'solid emerald control against its surface',
      },
      {
        foreground: 'action.danger.fill',
        background: 'surface.raised',
        requirement: 'boundary',
        usage: 'destructive button against its surface',
      },
      {
        foreground: 'scope.band.fill',
        background: 'surface.canvas',
        requirement: 'boundary',
        usage: 'the scoped-in band against the canvas',
        mitigation:
          'intentional: the band carries a 2px scope.band.edge, which measures 6.45:1 on the tenant canvas',
      },
      {
        foreground: 'scope.band.edge',
        background: 'surface.canvas',
        requirement: 'boundary',
        usage: 'the band edge against the canvas',
        mitigation:
          'intentional on the control plane: there the band fill itself carries the boundary against the canvas, and the edge is kept only so the band looks the same on both planes',
      },
      {
        foreground: 'scope.band.edge',
        background: 'scope.band.fill',
        requirement: 'boundary',
        usage: 'the band edge against the band fill',
      },
    ],
  },
  {
    title: 'Decorative hairlines',
    description:
      'Row and card edges where the surface change already separates the regions. No minimum applies, and these values are why border.control exists.',
    pairs: [
      {
        foreground: 'border.hairline',
        background: 'surface.canvas',
        requirement: 'decorative',
        usage: 'card edge on the canvas',
      },
      {
        foreground: 'border.hairline',
        background: 'surface.raised',
        requirement: 'decorative',
        usage: 'row divider on a raised surface',
      },
    ],
  },
]

export type Verdict = 'pass' | 'fail' | 'documented' | 'not applicable'

export type AuditRow = {
  section: string
  plane: Plane
  foreground: string
  foregroundPrimitive: string
  foregroundValue: string
  background: string
  backgroundPrimitive: string
  backgroundValue: string
  /** Surface a translucent background is painted over. */
  backdrop?: string
  ratio: number
  requirement: Requirement
  minimum: number | null
  verdict: Verdict
  usage: string
  mitigation?: string
}

function buildRow(section: string, pair: PairSpec, plane: Plane): AuditRow {
  const backgroundToken = semanticToken(pair.background)
  const backdropName = backgroundToken.over
  const backdrop = backdropName === undefined ? undefined : semanticValue(backdropName, plane)
  const foregroundValue = semanticValue(pair.foreground, plane)
  const backgroundValue = semanticValue(pair.background, plane)
  const ratio = roundRatio(contrastRatio(foregroundValue, backgroundValue, backdrop))
  const minimum = requirementMinimum[pair.requirement]

  let verdict: Verdict
  if (minimum === null) verdict = 'not applicable'
  else if (ratio >= minimum) verdict = 'pass'
  else if (pair.mitigation !== undefined) verdict = 'documented'
  else verdict = 'fail'

  return {
    section,
    plane,
    foreground: pair.foreground,
    foregroundPrimitive: semanticPrimitive(pair.foreground, plane),
    foregroundValue,
    background: pair.background,
    backgroundPrimitive: semanticPrimitive(pair.background, plane),
    backgroundValue,
    ...(backdropName === undefined ? {} : { backdrop: backdropName }),
    ratio,
    requirement: pair.requirement,
    minimum,
    verdict,
    usage: pair.usage,
    ...(pair.mitigation === undefined ? {} : { mitigation: pair.mitigation }),
  }
}

export function buildAudit(): AuditRow[] {
  return auditSections.flatMap((section) =>
    section.pairs.flatMap((pair) =>
      planes
        .filter((plane) => pair.onlyPlane === undefined || pair.onlyPlane === plane)
        .map((plane) => buildRow(section.title, pair, plane)),
    ),
  )
}

export type AuditTotals = {
  measured: number
  pass: number
  fail: number
  documented: number
  notApplicable: number
}

export function auditTotals(rows: AuditRow[]): AuditTotals {
  return {
    measured: rows.length,
    pass: rows.filter((row) => row.verdict === 'pass').length,
    fail: rows.filter((row) => row.verdict === 'fail').length,
    documented: rows.filter((row) => row.verdict === 'documented').length,
    notApplicable: rows.filter((row) => row.verdict === 'not applicable').length,
  }
}

/**
 * Ratios the spec asserts in its "Contrast rules" list. The pairs are named by
 * primitive step rather than by hex, so the assertion is measured against the
 * project's own scales: if a primitive ever changed, the assertion would move
 * with it and the disagreement would surface here.
 */
export type SpecAssertion = {
  /** Primitive name, e.g. `zinc.500`. */
  foreground: string
  /** Primitive name, e.g. `zinc.100`. */
  background: string
  asserted: number
  claim: string
}

export const specAssertions: SpecAssertion[] = [
  { foreground: 'zinc.500', background: 'zinc.100', asserted: 4.4, claim: 'zinc.500 fails AA for body copy on the tenant canvas' },
  { foreground: 'zinc.600', background: 'zinc.100', asserted: 7.03, claim: 'zinc.600 is the secondary body colour on the tenant canvas' },
  { foreground: 'zinc.600', background: 'white', asserted: 7.73, claim: 'zinc.600 on a raised surface' },
  { foreground: 'white', background: 'emerald.700', asserted: 5.48, claim: 'solid emerald fills carrying white text use emerald.700' },
  { foreground: 'white', background: 'emerald.600', asserted: 3.77, claim: 'emerald.600 with white is a marker colour, not a label colour' },
  { foreground: 'white', background: 'amber.600', asserted: 3.19, claim: 'the warning fill never carries white text' },
  { foreground: 'zinc.950', background: 'amber.600', asserted: 6.25, claim: 'the warning fill takes near-black text' },
  { foreground: 'zinc.400', background: 'zinc.900', asserted: 6.91, claim: 'dark-plane secondary text on a raised surface' },
  { foreground: 'zinc.400', background: 'zinc.950', asserted: 7.76, claim: 'dark-plane secondary text on the canvas' },
  { foreground: 'zinc.500', background: 'white', asserted: 4.83, claim: 'border.control on white' },
  { foreground: 'zinc.500', background: 'zinc.900', asserted: 3.67, claim: 'border.control on zinc.900' },
  { foreground: 'zinc.500', background: 'zinc.950', asserted: 4.12, claim: 'border.control on zinc.950' },
  { foreground: 'zinc.300', background: 'white', asserted: 1.48, claim: 'the lighter zinc steps stay decorative hairlines' },
  { foreground: 'scope.amber', background: 'zinc.100', asserted: 1.95, claim: 'the amber fill alone is not enough boundary' },
  { foreground: 'amber.800', background: 'zinc.100', asserted: 6.45, claim: 'the band edge against the tenant canvas' },
  { foreground: 'amber.800', background: 'scope.amber', asserted: 3.3, claim: 'the band edge against the band fill' },
  { foreground: 'zinc.600', background: 'zinc.900', asserted: 2.42, claim: 'why rail labels do not use content.secondary' },
]

export type AssertionResult = SpecAssertion & {
  foregroundValue: string
  backgroundValue: string
  measured: number
  agrees: boolean
}

export function checkSpecAssertions(): AssertionResult[] {
  return specAssertions.map((assertion) => {
    const foregroundValue = primitiveValue(assertion.foreground)
    const backgroundValue = primitiveValue(assertion.background)
    const measured = roundRatio(contrastRatio(foregroundValue, backgroundValue))
    return {
      ...assertion,
      foregroundValue,
      backgroundValue,
      measured,
      agrees: Math.abs(measured - assertion.asserted) < 0.005,
    }
  })
}
