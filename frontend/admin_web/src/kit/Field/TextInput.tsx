import { type KeyboardEvent, type ReactElement } from 'react'

import { Button } from '../Button/Button.tsx'
import type { TextInputProps } from './Field.types.ts'
import styles from './Field.module.css'

export function TextInput({
  value,
  onChange,
  placeholder,
  inputMode,
  type = 'text',
  maxLength,
  autoComplete,
  leadingIcon,
  clearable,
  clearLabel = 'Clear',
  shortcutHint,
  ref,
  id,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
  disabled,
  readOnly,
}: TextInputProps): ReactElement {
  const hasLeading = leadingIcon !== undefined
  const hasTrailing = clearable === true || shortcutHint !== undefined

  const inputClass = [
    styles.input,
    'text-body',
    hasLeading ? styles.inputWithLeading : '',
    hasTrailing ? styles.inputWithTrailing : '',
    ariaInvalid === true ? styles.inputError : '',
  ]
    .filter(Boolean)
    .join(' ')

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (clearable === true && event.key === 'Escape' && value.length > 0) {
      event.preventDefault()
      onChange('')
    }
  }

  return (
    <div className={styles.controlShell}>
      {hasLeading ? (
        <span className={styles.leadingIcon} aria-hidden="true">
          {leadingIcon}
        </span>
      ) : null}
      <input
        ref={ref}
        id={id}
        className={inputClass}
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete={autoComplete}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        aria-required={ariaRequired}
        disabled={disabled}
        readOnly={readOnly}
      />
      {hasTrailing ? (
        <div className={styles.trailingSlot}>
          {shortcutHint !== undefined ? (
            <span className={`${styles.shortcutHint} text-caption`} aria-hidden="true">
              {shortcutHint}
            </span>
          ) : null}
          {clearable === true && value.length > 0 ? (
            <Button
              tone="ghost"
              iconOnly
              label={clearLabel}
              icon={<ClearIcon />}
              compact
              onClick={() => onChange('')}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function ClearIcon(): ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M4 4l8 8M12 4l-8 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
