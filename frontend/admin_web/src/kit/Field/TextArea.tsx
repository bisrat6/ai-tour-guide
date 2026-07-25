import type { ReactElement } from 'react'

import type { TextAreaProps } from './Field.types.ts'
import styles from './Field.module.css'

export function TextArea({
  value,
  onChange,
  rows = 4,
  maxLength,
  showCount,
  ref,
  id,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  disabled,
  readOnly,
}: TextAreaProps): ReactElement {
  const textareaClass = [
    styles.textarea,
    'text-body',
    ariaInvalid === true ? styles.textareaError : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <textarea
        ref={ref}
        id={id}
        className={textareaClass}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={maxLength}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        aria-required={ariaRequired}
        disabled={disabled}
        readOnly={readOnly}
      />
      {showCount === true && maxLength !== undefined ? (
        <p className={`${styles.count} text-caption`}>
          {value.length} of {maxLength}
        </p>
      ) : null}
    </>
  )
}
