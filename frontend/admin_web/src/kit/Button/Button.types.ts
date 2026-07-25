import type { MouseEvent, ReactNode, Ref } from 'react'

export type ButtonTone = 'primary' | 'secondary' | 'ghost' | 'danger'

/** md = 44px, lg = 52px. There is no small button: 44px is the floor. */
export type ButtonSize = 'md' | 'lg'

type ButtonBase = {
  readonly tone?: ButtonTone
  readonly size?: ButtonSize
  /** Narrows horizontal padding only. Height never drops below 44px. */
  readonly compact?: boolean
  readonly fullWidth?: boolean
  readonly type?: 'button' | 'submit' | 'reset'
  readonly disabled?: boolean
  /**
   * Rendered as a tooltip and as aria-describedby text. Use for pending
   * integrations only. A control the user's role forbids is not disabled —
   * it is absent (spec section 8.5).
   */
  readonly disabledReason?: string
  /** Shows a spinner and sets aria-busy. The label does not change. */
  readonly busy?: boolean
  readonly onClick?: (event: MouseEvent<HTMLButtonElement>) => void
  readonly ref?: Ref<HTMLButtonElement>
  readonly id?: string
  readonly className?: string
  readonly 'aria-describedby'?: string
  readonly 'aria-expanded'?: boolean
  readonly 'aria-controls'?: string
  readonly 'aria-haspopup'?: 'dialog' | 'listbox' | 'menu' | true
  readonly 'aria-pressed'?: boolean
  readonly 'data-testid'?: string
}

export type ButtonProps =
  | (ButtonBase & {
      readonly children: ReactNode
      readonly leadingIcon?: ReactNode
      readonly trailingIcon?: ReactNode
      readonly iconOnly?: false
    })
  | (ButtonBase & {
      readonly iconOnly: true
      /** Required: an icon-only button cannot ship without an accessible name. */
      readonly label: string
      readonly icon: ReactNode
      readonly children?: never
    })
