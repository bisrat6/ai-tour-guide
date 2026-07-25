import { useId, type MouseEvent, type ReactElement } from 'react'

import { VisuallyHidden } from '../State/VisuallyHidden.tsx'
import type { ButtonProps } from './Button.types.ts'
import styles from './Button.module.css'

function Spinner(): ReactElement {
  return <span className={styles.spinner} aria-hidden="true" />
}

function toneClass(tone: NonNullable<ButtonProps['tone']>): string {
  if (tone === 'secondary') return styles.secondary
  if (tone === 'ghost') return styles.ghost
  if (tone === 'danger') return styles.danger
  return styles.primary
}

export function Button(props: ButtonProps): ReactElement {
  const reasonId = useId()
  const tone = props.tone ?? 'primary'
  const size = props.size ?? 'md'
  const isDisabled = props.disabled === true
  const isBusy = props.busy === true

  const classNames = [
    styles.root,
    'text-body',
    toneClass(tone),
    size === 'lg' ? styles.sizeLg : '',
    props.compact === true ? styles.compact : '',
    props.fullWidth === true ? styles.fullWidth : '',
    isDisabled ? styles.disabled : '',
    isBusy ? styles.busy : '',
    props.className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  const describedBy =
    [props['aria-describedby'], isDisabled && props.disabledReason ? reasonId : null]
      .filter(Boolean)
      .join(' ') || undefined

  function handleClick(event: MouseEvent<HTMLButtonElement>): void {
    if (isBusy) {
      event.preventDefault()
      return
    }
    props.onClick?.(event)
  }

  const button = (
    <button
      ref={props.ref}
      id={props.id}
      type={props.type ?? 'button'}
      className={
        props.iconOnly === true
          ? `${classNames} ${styles.iconOnly}`
          : classNames
      }
      disabled={isDisabled}
      aria-busy={isBusy ? true : undefined}
      aria-describedby={describedBy}
      aria-expanded={props['aria-expanded']}
      aria-controls={props['aria-controls']}
      aria-haspopup={props['aria-haspopup']}
      aria-pressed={props['aria-pressed']}
      aria-label={props.iconOnly === true ? props.label : undefined}
      title={isDisabled && props.disabledReason !== undefined ? props.disabledReason : undefined}
      data-testid={props['data-testid']}
      onClick={handleClick}
    >
      {isBusy ? <Spinner /> : null}
      {props.iconOnly === true ? (
        <span className={styles.icon} aria-hidden="true">
          {props.icon}
        </span>
      ) : (
        <span className={styles.label}>
          {!isBusy && props.leadingIcon !== undefined ? (
            <span className={styles.icon} aria-hidden="true">
              {props.leadingIcon}
            </span>
          ) : null}
          {props.children}
          {props.trailingIcon !== undefined ? (
            <span className={styles.icon} aria-hidden="true">
              {props.trailingIcon}
            </span>
          ) : null}
        </span>
      )}
    </button>
  )

  if (isDisabled && props.disabledReason !== undefined) {
    const wrapperClass = props.fullWidth === true ? styles.wrapperFullWidth : styles.wrapper
    return (
      <span className={wrapperClass} aria-describedby={reasonId} title={props.disabledReason}>
        <VisuallyHidden id={reasonId}>{props.disabledReason}</VisuallyHidden>
        {button}
      </span>
    )
  }

  return button
}
