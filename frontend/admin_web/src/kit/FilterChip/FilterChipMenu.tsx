import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactElement } from 'react'

import { useDismiss } from '../internal/useDismiss.ts'
import type { FilterOption } from './FilterChip.types.ts'
import styles from './FilterChip.module.css'

export type FilterChipMenuProps = {
  readonly id: string
  readonly options: readonly FilterOption[]
  readonly selected: readonly string[]
  readonly multiple: boolean
  readonly open: boolean
  readonly onClose: () => void
  readonly onChange: (next: readonly string[]) => void
  readonly triggerRef: React.RefObject<HTMLButtonElement | null>
}

/** Custom listbox for filter chip multi-select. */
export function FilterChipMenu({
  id,
  options,
  selected,
  multiple,
  open,
  onClose,
  onChange,
  triggerRef,
}: FilterChipMenuProps): ReactElement | null {
  const menuRef = useRef<HTMLDivElement>(null)
  const [focusedIndex, setFocusedIndex] = useState(0)
  const typeAheadRef = useRef('')
  const typeAheadTimerRef = useRef<number | undefined>(undefined)

  const selectedSet = useMemo(() => new Set(selected), [selected])

  const firstSelectedIndex = useMemo(() => {
    const index = options.findIndex((option) => selectedSet.has(option.value))
    return index >= 0 ? index : 0
  }, [options, selectedSet])

  useEffect(() => {
    if (open) {
      setFocusedIndex(firstSelectedIndex)
      typeAheadRef.current = ''
      menuRef.current?.focus()
    }
  }, [open, firstSelectedIndex])

  useDismiss({
    enabled: open,
    onDismiss: onClose,
    containerRef: menuRef,
    dismissOnOutsidePress: true,
    returnFocusTo: triggerRef,
  })

  const toggleOption = useCallback(
    (value: string) => {
      if (multiple) {
        const next = selectedSet.has(value)
          ? selected.filter((entry) => entry !== value)
          : [...selected, value]
        onChange(next)
        return
      }
      onChange([value])
      onClose()
      triggerRef.current?.focus()
    },
    [multiple, onChange, onClose, selected, selectedSet, triggerRef],
  )

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setFocusedIndex((current) => Math.min(current + 1, options.length - 1))
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setFocusedIndex((current) => Math.max(current - 1, 0))
        return
      }

      if (event.key === 'Home') {
        event.preventDefault()
        setFocusedIndex(0)
        return
      }

      if (event.key === 'End') {
        event.preventDefault()
        setFocusedIndex(options.length - 1)
        return
      }

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        const option = options[focusedIndex]
        if (option !== undefined) toggleOption(option.value)
        return
      }

      if (event.key === 'Tab') {
        onClose()
        return
      }

      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        typeAheadRef.current += event.key.toLowerCase()
        window.clearTimeout(typeAheadTimerRef.current)
        typeAheadTimerRef.current = window.setTimeout(() => {
          typeAheadRef.current = ''
        }, 500)

        const query = typeAheadRef.current
        const matchIndex = options.findIndex((option) =>
          option.label.toLowerCase().startsWith(query),
        )
        if (matchIndex >= 0) setFocusedIndex(matchIndex)
      }
    },
    [focusedIndex, onClose, options, toggleOption],
  )

  if (!open) return null

  return (
    <div
      ref={menuRef}
      id={id}
      role="listbox"
      aria-multiselectable={multiple ? true : undefined}
      className={styles.menu}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      {options.map((option, index) => {
        const isSelected = selectedSet.has(option.value)
        const isFocused = index === focusedIndex
        const optionClass = [
          styles.option,
          'text-body',
          isFocused ? styles.optionFocused : '',
          isSelected ? styles.optionSelected : '',
        ]
          .filter(Boolean)
          .join(' ')

        return (
          <button
            key={option.value}
            type="button"
            role="option"
            aria-selected={isSelected}
            className={optionClass}
            onMouseEnter={() => setFocusedIndex(index)}
            onClick={() => toggleOption(option.value)}
          >
            {multiple ? (
              <span className={styles.optionTick} aria-hidden="true">
                {isSelected ? '✓' : ''}
              </span>
            ) : null}
            <span>{option.label}</span>
            {option.count !== undefined ? (
              <span className={`${styles.optionCount} text-caption`}>{option.count}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
