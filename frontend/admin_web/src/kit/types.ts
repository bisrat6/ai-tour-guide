import type { ReactNode } from 'react'

/** The four status families. Each has a fixed marker shape; see StatusBadge. */
export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral'

/** The four marker shapes from admin-web-design.md section 5. */
export type StatusMarker = 'dot' | 'ring' | 'cross' | 'dash'

/** Section 10: no figure is rendered without saying where it came from. */
export type Provenance = 'live' | 'demo' | 'pending'

/** A labelled thing the user can do from inside a state message. */
export type StateAction = {
  readonly label: string
  readonly onAct: () => void
}

/**
 * The five states from section 7, plus `ready`. Required fields are required
 * on purpose: a failure cannot compile without saying what broke, and an
 * integration-pending state cannot compile without naming its dependency.
 */
export type KitState =
  | { readonly kind: 'ready' }
  | { readonly kind: 'loading'; readonly label?: string }
  | {
      readonly kind: 'empty'
      readonly title: string
      readonly body?: string
      readonly action?: StateAction
    }
  | {
      readonly kind: 'failure'
      readonly title: string
      readonly body: string
      readonly retry?: StateAction
    }
  | {
      readonly kind: 'unauthorized'
      readonly title: string
      readonly body: string
    }
  | {
      readonly kind: 'integrationPending'
      readonly dependency: string
      readonly body: string
      readonly stillUsable?: string
    }

export type StateKind = KitState['kind']

/** Highest first. Every component resolves conflicts in this order. */
export const STATE_PRECEDENCE = [
  'unauthorized',
  'integrationPending',
  'failure',
  'loading',
  'empty',
  'ready',
] as const satisfies readonly StateKind[]

export function resolveState(...candidates: readonly (KitState | undefined)[]): KitState {
  for (const kind of STATE_PRECEDENCE) {
    const hit = candidates.find((candidate) => candidate?.kind === kind)
    if (hit !== undefined) return hit
  }
  return { kind: 'ready' }
}

export const READY: KitState = { kind: 'ready' }

/** Sizes never go below the 44px target; density changes padding, not height. */
export type ControlSize = 'md' | 'lg'
export type Density = 'comfortable' | 'compact'

export type WithChildren = { readonly children: ReactNode }
