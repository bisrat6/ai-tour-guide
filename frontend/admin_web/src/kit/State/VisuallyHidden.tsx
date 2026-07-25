import type { ReactElement } from 'react'

import { SR_ONLY_CLASS } from '../internal/srOnly.ts'
import type { VisuallyHiddenProps } from './State.types.ts'

/** Screen-reader-only wrapper using the kit-wide visually-hidden class. */
export function VisuallyHidden({
  children,
  as: Tag = 'span',
  id,
}: VisuallyHiddenProps): ReactElement {
  return (
    <Tag className={SR_ONLY_CLASS} id={id}>
      {children}
    </Tag>
  )
}
