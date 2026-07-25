import type { ReactElement } from 'react'

/** Simple cross glyph for icon-only close controls. */
export function CrossIcon(): ReactElement {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden="true" focusable="false">
      <path
        d="M4 4l8 8M12 4l-8 8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}
