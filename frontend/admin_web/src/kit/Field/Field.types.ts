import type { ChangeEvent, ReactNode, Ref } from 'react'

/** Props the Field computes and the control must spread onto its element. */
export type FieldControlProps = {
  readonly id: string
  readonly 'aria-describedby': string | undefined
  readonly 'aria-invalid': true | undefined
  readonly 'aria-required': true | undefined
  readonly disabled: boolean
  readonly readOnly: boolean
}

export type FieldProps = {
  readonly id: string
  readonly label: string
  /** Persistent guidance. Stays visible when an error appears. */
  readonly hint?: string
  /** Validation message. Its presence sets aria-invalid on the control. */
  readonly error?: string
  readonly required?: boolean
  /** Marks optional fields instead of required ones, for mostly-optional forms. */
  readonly markOptional?: boolean
  readonly readOnly?: boolean
  readonly disabled?: boolean
  readonly disabledReason?: string
  readonly labelHidden?: boolean
  readonly children: (control: FieldControlProps) => ReactNode
}

export type TextInputProps = {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly placeholder?: string
  readonly inputMode?: 'text' | 'numeric' | 'email' | 'search' | 'url'
  readonly type?: 'text' | 'email' | 'password' | 'search' | 'number' | 'url'
  readonly maxLength?: number
  readonly autoComplete?: string
  readonly leadingIcon?: ReactNode
  /** Renders a clear button when non-empty. Search fields only. */
  readonly clearable?: boolean
  readonly clearLabel?: string
  /** Keyboard hint pill rendered inside the field, e.g. "⌘K". */
  readonly shortcutHint?: string
  readonly ref?: Ref<HTMLInputElement>
} & FieldControlProps

export type TextAreaProps = {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly rows?: number
  readonly maxLength?: number
  /** Shows "220 of 500" beneath. Requires maxLength. */
  readonly showCount?: boolean
  readonly ref?: Ref<HTMLTextAreaElement>
} & FieldControlProps

export type SelectOption = {
  readonly value: string
  readonly label: string
  readonly disabled?: boolean
}

export type SelectProps = {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly options: readonly SelectOption[]
  readonly placeholder?: string
  readonly ref?: Ref<HTMLSelectElement>
} & FieldControlProps

export type CheckboxProps = {
  readonly checked: boolean
  /** Header select-all uses this; sets the DOM indeterminate property. */
  readonly indeterminate?: boolean
  readonly onChange: (checked: boolean, event: ChangeEvent<HTMLInputElement>) => void
  readonly label: string
  readonly labelHidden?: boolean
  readonly disabled?: boolean
  readonly ref?: Ref<HTMLInputElement>
  readonly id?: string
  readonly 'aria-describedby'?: string
}
