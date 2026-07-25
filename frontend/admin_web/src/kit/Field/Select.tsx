import type { ReactElement } from 'react'

import type { SelectProps } from './Field.types.ts'
import styles from './Field.module.css'

export function Select({
  value,
  onChange,
  options,
  placeholder,
  ref,
  id,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  disabled,
  readOnly,
}: SelectProps): ReactElement {
  const selectClass = [
    styles.select,
    'text-body',
    ariaInvalid === true ? styles.selectError : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <select
      ref={ref}
      id={id}
      className={selectClass}
      value={disabled === true && value.length === 0 ? '' : value}
      onChange={(event) => onChange(event.target.value)}
      aria-describedby={ariaDescribedBy}
      aria-invalid={ariaInvalid}
      aria-required={ariaRequired}
      disabled={disabled || readOnly}
    >
      {placeholder !== undefined ? (
        <option value="" disabled>
          {placeholder}
        </option>
      ) : null}
      {disabled === true && value.length === 0 ? (
        <option value="">—</option>
      ) : null}
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  )
}
