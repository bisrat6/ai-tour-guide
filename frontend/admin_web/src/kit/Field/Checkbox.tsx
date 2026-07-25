import { useEffect, useRef, type ChangeEvent, type ReactElement, type Ref } from 'react'

import { VisuallyHidden } from '../State/VisuallyHidden.tsx'
import type { CheckboxProps } from './Field.types.ts'
import styles from './Field.module.css'

function assignRef(element: HTMLInputElement | null, ref: Ref<HTMLInputElement> | undefined): void {
  if (typeof ref === 'function') {
    ref(element)
    return
  }
  if (ref !== undefined && ref !== null) {
    ref.current = element
  }
}

export function Checkbox({
  checked,
  indeterminate,
  onChange,
  label,
  labelHidden,
  disabled,
  ref,
  id,
  'aria-describedby': ariaDescribedBy,
}: CheckboxProps): ReactElement {
  const localRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const element = localRef.current
    if (element !== null) {
      element.indeterminate = indeterminate === true
    }
  }, [indeterminate])

  const labelClass = [
    styles.checkboxLabel,
    disabled === true ? styles.checkboxLabelDisabled : '',
  ]
    .filter(Boolean)
    .join(' ')

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    onChange(event.target.checked, event)
  }

  function handleRef(element: HTMLInputElement | null): void {
    localRef.current = element
    assignRef(element, ref)
    if (element !== null) {
      element.indeterminate = indeterminate === true
    }
  }

  return (
    <label htmlFor={id} className={labelClass}>
      <span className={styles.checkboxBox}>
        <input
          ref={handleRef}
          id={id}
          type="checkbox"
          className={styles.checkboxInput}
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          aria-describedby={ariaDescribedBy}
        />
        <span className={styles.checkboxVisual} aria-hidden="true">
          {indeterminate === true ? <IndeterminateMark /> : checked ? <CheckMark /> : null}
        </span>
      </span>
      {labelHidden === true ? (
        <VisuallyHidden>{label}</VisuallyHidden>
      ) : (
        <span className={`${styles.checkboxText} text-body`}>{label}</span>
      )}
    </label>
  )
}

function CheckMark(): ReactElement {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" focusable="false">
      <path
        d="M2 5.2 4.1 7.3 8 3.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IndeterminateMark(): ReactElement {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" focusable="false">
      <line
        x1="2"
        y1="5"
        x2="8"
        y2="5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
