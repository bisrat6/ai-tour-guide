/**
 * Component token layer. These are the handles Phase 2 components will consume.
 * Each one resolves to a semantic or scale token, never to a primitive and
 * never to a raw value, so a component token inherits plane theming for free.
 *
 * src/styles/components.css is generated from this file by `npm run tokens:build`.
 */

import { toCssVar } from './primitives.ts'
import { scaleRef, scaleToken } from './scales.ts'
import { semanticToken } from './semantic.ts'

export type ComponentToken = {
  name: string
  cssVar: string
  /** The semantic or scale token this resolves to, for the review table. */
  resolves: string
  value: string
  note?: string
}

function fromSemantic(name: string, semantic: string, note?: string): ComponentToken {
  return {
    name,
    cssVar: toCssVar(name),
    resolves: semantic,
    value: `var(${semanticToken(semantic).cssVar})`,
    ...(note === undefined ? {} : { note }),
  }
}

function fromScale(name: string, scale: string, note?: string): ComponentToken {
  return {
    name,
    cssVar: toCssVar(name),
    resolves: scale,
    value: scaleRef(scale),
    ...(note === undefined ? {} : { note }),
  }
}

function fromEffect(name: string, effectVar: string, resolves: string, note?: string): ComponentToken {
  return {
    name,
    cssVar: toCssVar(name),
    resolves,
    value: `var(${effectVar})`,
    ...(note === undefined ? {} : { note }),
  }
}

export type ComponentGroup = {
  title: string
  tokens: ComponentToken[]
}

export const componentGroups: ComponentGroup[] = [
  {
    title: 'Sidebar',
    tokens: [
      fromSemantic('sidebar.surface', 'surface.sidebar'),
      fromSemantic('sidebar.edge', 'surface.sidebarEdge'),
      fromSemantic('sidebar.text', 'content.onSidebar'),
      fromSemantic('sidebar.textMuted', 'content.onSidebarMuted'),
      fromSemantic('sidebar.activeMarker', 'accent.mark'),
      fromScale('sidebar.itemRadius', 'radius.control'),
      fromScale('sidebar.itemMinHeight', 'target.min'),
    ],
  },
  {
    title: 'Status badge',
    tokens: [
      fromSemantic('badge.success.tint', 'status.success.tint'),
      fromSemantic('badge.success.text', 'status.success.onTint'),
      fromSemantic('badge.danger.tint', 'status.danger.tint'),
      fromSemantic('badge.danger.text', 'status.danger.onTint'),
      fromSemantic('badge.warning.tint', 'status.warning.tint'),
      fromSemantic('badge.warning.text', 'status.warning.onTint'),
      fromSemantic('badge.neutral.tint', 'status.neutral.tint'),
      fromSemantic('badge.neutral.text', 'status.neutral.onTint'),
      fromScale('badge.radius', 'radius.round', 'status pills are fully round'),
    ],
  },
  {
    title: 'Scoped-in band',
    tokens: [
      fromSemantic('scopeBand.surface', 'scope.band.fill'),
      fromSemantic('scopeBand.content', 'scope.band.text'),
      fromSemantic('scopeBand.edgeColor', 'scope.band.edge'),
      fromScale('scopeBand.edgeWidth', 'border.scopeEdgeWidth'),
      fromScale('scopeBand.minHeight', 'target.min'),
    ],
  },
  {
    title: 'Focus ring',
    tokens: [
      fromSemantic('focusRing.color', 'focus.ring'),
      fromScale('focusRing.width', 'focus.width'),
      fromScale('focusRing.offset', 'focus.offset'),
    ],
  },
  {
    title: 'Panel and overlay',
    tokens: [
      fromSemantic('panel.surface', 'surface.raised'),
      fromSemantic('panel.border', 'border.hairline'),
      fromScale('panel.radius', 'radius.surface'),
      fromEffect('panel.shadow', '--elevation-soft', 'elevation.soft'),
      fromSemantic('overlay.surface', 'surface.overlay'),
      fromSemantic('overlay.scrim', 'surface.scrim'),
      fromScale('overlay.radius', 'radius.surface'),
    ],
  },
  {
    title: 'Button',
    tokens: [
      fromScale('button.radius', 'radius.surface'),
      fromScale('button.minHeight', 'target.min'),
      fromSemantic('button.primary.fill', 'action.primary.fill'),
      fromSemantic('button.primary.text', 'action.primary.text'),
      fromSemantic('button.primary.fillHover', 'action.primary.fillHover'),
      fromSemantic('button.secondary.fill', 'action.secondary.fill'),
      fromSemantic('button.secondary.text', 'action.secondary.text'),
      fromSemantic('button.secondary.border', 'action.secondary.border'),
      fromSemantic('button.secondary.fillHover', 'action.secondary.fillHover'),
      fromSemantic('button.ghost.text', 'content.primary'),
      fromSemantic('button.ghost.fillHover', 'surface.hover'),
      fromSemantic('button.danger.fill', 'action.danger.fill'),
      fromSemantic('button.danger.text', 'action.danger.text'),
      fromSemantic('button.danger.fillHover', 'action.danger.fillHover'),
      fromSemantic('button.disabled.fill', 'surface.sunken'),
      fromSemantic('button.disabled.text', 'content.muted'),
      fromSemantic('button.disabled.border', 'border.hairline'),
    ],
  },
  {
    title: 'Data table',
    tokens: [
      fromSemantic('table.surface', 'surface.raised'),
      fromSemantic('table.headerSurface', 'surface.raised'),
      fromSemantic('table.hairline', 'border.hairline'),
      fromSemantic('table.headerText', 'content.secondary'),
      fromSemantic('table.cellText', 'content.primary'),
      fromSemantic('table.cellTextMuted', 'content.secondary'),
      fromSemantic('table.rowSelected', 'selection.row'),
      fromSemantic('table.rowHover', 'surface.hover'),
      fromSemantic('table.selectionBar', 'accent.mark'),
      fromSemantic('table.sortIcon', 'content.muted'),
      fromSemantic('table.sortIconActive', 'accent.mark'),
      fromScale('table.rowMinHeight', 'target.min'),
    ],
  },
  {
    title: 'Field',
    tokens: [
      fromSemantic('field.surface', 'surface.raised'),
      fromSemantic('field.border', 'border.control'),
      fromSemantic('field.text', 'content.primary'),
      fromSemantic('field.label', 'content.secondary'),
      fromScale('field.radius', 'radius.control'),
      fromScale('field.minHeight', 'target.min'),
    ],
  },
  {
    title: 'Chip',
    tokens: [
      fromSemantic('chip.fill', 'surface.raised'),
      fromSemantic('chip.text', 'content.primary'),
      fromSemantic('chip.border', 'border.control'),
      fromSemantic('chip.hoverFill', 'surface.hover'),
      fromSemantic('chip.selected.fill', 'accent.tint'),
      fromSemantic('chip.selected.text', 'accent.onTint'),
      fromSemantic('chip.selected.border', 'accent.mark'),
      fromScale('chip.radius', 'radius.control'),
      fromScale('chip.minHeight', 'target.min'),
    ],
  },
  {
    title: 'Tabs',
    tokens: [
      fromSemantic('tab.text', 'content.secondary'),
      fromSemantic('tab.textActive', 'content.primary'),
      fromSemantic('tab.indicator', 'accent.mark'),
      fromSemantic('tab.hoverFill', 'surface.hover'),
      fromScale('tab.minHeight', 'target.min'),
    ],
  },
  {
    title: 'Skeleton',
    tokens: [
      fromSemantic('skeleton.base', 'surface.sunken'),
      fromSemantic('skeleton.sheen', 'surface.shimmer'),
    ],
  },
  {
    title: 'Toast',
    tokens: [
      fromSemantic('toast.surface', 'surface.overlay'),
      fromSemantic('toast.border', 'border.hairline'),
      fromSemantic('toast.text', 'content.primary'),
      fromScale('toast.radius', 'radius.surface'),
      fromEffect('toast.shadow', '--elevation-soft', 'elevation.soft'),
      fromSemantic('toast.mark.success', 'feedback.success'),
      fromSemantic('toast.mark.danger', 'feedback.danger'),
      fromSemantic('toast.mark.neutral', 'feedback.neutral'),
    ],
  },
  {
    title: 'KPI card',
    tokens: [
      fromSemantic('kpi.surface', 'surface.raised'),
      fromSemantic('kpi.border', 'border.hairline'),
      fromSemantic('kpi.label', 'content.secondary'),
      fromSemantic('kpi.value', 'content.primary'),
      fromScale('kpi.radius', 'radius.surface'),
      fromSemantic('kpi.provenanceTint', 'status.neutral.tint'),
      fromSemantic('kpi.provenanceText', 'status.neutral.onTint'),
    ],
  },
  {
    title: 'Chart',
    tokens: [
      fromSemantic('chart.series.primary', 'accent.mark'),
      fromSemantic('chart.series.comparison', 'feedback.neutral'),
      fromSemantic('chart.grid', 'border.hairline'),
      fromSemantic('chart.axisText', 'content.secondary'),
      fromSemantic('chart.tooltipSurface', 'surface.overlay'),
      fromSemantic('chart.tooltipText', 'content.primary'),
      fromSemantic('chart.tooltipBorder', 'border.hairline'),
    ],
  },
  {
    title: 'Bulk bar',
    tokens: [
      fromSemantic('bulkBar.surface', 'surface.overlay'),
      fromSemantic(
        'bulkBar.border',
        'border.control',
        'a floating white bar over white content needs a boundary that clears 3:1',
      ),
      fromScale('bulkBar.radius', 'radius.surface'),
      fromEffect('bulkBar.shadow', '--elevation-soft', 'elevation.soft'),
      fromSemantic('bulkBar.count', 'content.primary'),
    ],
  },
]

export const componentTokens: ComponentToken[] = componentGroups.flatMap((group) => group.tokens)

/** Guard: a component token may only point at a semantic, scale or effect token. */
export function assertComponentTokensResolve(): void {
  for (const entry of componentTokens) {
    if (entry.value.startsWith('var(--elevation-')) continue
    const isSemantic = entry.value === `var(${safeSemanticVar(entry.resolves)})`
    const isScale = entry.value === `var(${safeScaleVar(entry.resolves)})`
    if (!isSemantic && !isScale) {
      throw new Error(`Component token ${entry.name} does not resolve to a semantic or scale token`)
    }
  }
}

function safeSemanticVar(name: string): string {
  try {
    return semanticToken(name).cssVar
  } catch {
    return ''
  }
}

function safeScaleVar(name: string): string {
  try {
    return scaleToken(name).cssVar
  } catch {
    return ''
  }
}
