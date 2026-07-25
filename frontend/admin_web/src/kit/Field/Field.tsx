import { useState, type ReactElement } from 'react'

import { SR_ONLY_CLASS } from '../internal/srOnly.ts'
import { StatusMarkerGlyph } from '../State/StatusMarkerGlyph.tsx'
import { VisuallyHidden } from '../State/VisuallyHidden.tsx'
import type { FieldControlProps, FieldProps } from './Field.types.ts'
import styles from './Field.module.css'

export function Field({
  id,
  label,
  hint,
  error,
  required,
  markOptional,
  readOnly,
  disabled,
  disabledReason,
  labelHidden,
  children,
}: FieldProps): ReactElement {
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const [touched, setTouched] = useState(false)

  const describedBy =
    [hint !== undefined ? hintId : null, error !== undefined ? errorId : null]
      .filter(Boolean)
      .join(' ') || undefined

  const controlProps: FieldControlProps = {
    id,
    'aria-describedby': describedBy,
    'aria-invalid': error !== undefined ? true : undefined,
    'aria-required': required === true ? true : undefined,
    disabled: disabled === true,
    readOnly: readOnly === true,
  }

  const showOptional = markOptional === true && required !== true
  const showRequired = required === true

  return (
    <div
      className={styles.root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setTouched(true)
        }
      }}
    >
      <div className={styles.labelRow}>
        <label
          htmlFor={id}
          className={
            labelHidden === true
              ? `${SR_ONLY_CLASS} text-caption ${styles.labelSemibold}`
              : `${styles.label} text-caption ${styles.labelSemibold}`
          }
        >
          {label}
        </label>
        {showRequired ? (
          <span className={`${styles.mark} text-caption`}>Required</span>
        ) : null}
        {showOptional ? (
          <span className={`${styles.mark} text-caption`}>Optional</span>
        ) : null}
        {readOnly === true ? (
          <span className={`${styles.mark} text-caption`}>Read only</span>
        ) : null}
      </div>

      {disabled === true && disabledReason !== undefined ? (
        <VisuallyHidden>{disabledReason}</VisuallyHidden>
      ) : null}

      {children(controlProps)}

      {hint !== undefined ? (
        <p id={hintId} className={`${styles.hint} text-caption`}>
          {hint}
        </p>
      ) : null}

      {error !== undefined ? (
        <p
          id={errorId}
          className={`${styles.error} text-caption`}
          role={touched ? 'alert' : undefined}
        >
          <span className={styles.errorMarker} aria-hidden="true">
            <StatusMarkerGlyph marker="cross" size={12} />
          </span>
          {error}
        </p>
      ) : null}
    </div>
  )
}
