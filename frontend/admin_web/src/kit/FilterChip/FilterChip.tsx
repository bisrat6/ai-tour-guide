import {
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
} from 'react'

import { Skeleton } from '../State/Skeleton.tsx'
import { VisuallyHidden } from '../State/VisuallyHidden.tsx'
import type { FilterChipProps } from './FilterChip.types.ts'
import styles from './FilterChip.module.css'
import { FilterChipMenu } from './FilterChipMenu.tsx'
import { summarizeFilterChip } from './FilterChip.utils.ts'

function ClearChipIcon(): ReactElement {
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

export function FilterChip({
  id,
  label,
  options,
  selected,
  onChange,
  multiple = false,
  summarize,
  disabled,
  disabledReason,
  state = { kind: 'ready' },
}: FilterChipProps): ReactElement {
  const menuId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)

  const isLoading = state.kind === 'loading'
  const isFailure = state.kind === 'failure'
  const isDisabled = disabled === true || isFailure
  const resolvedReason =
    disabledReason ??
    (isFailure ? 'Filter options did not load.' : undefined)

  const summary = useMemo(() => {
    const base = { label, options, selected }
    if (summarize !== undefined) {
      return summarizeFilterChip({ ...base, summarize })
    }
    return summarizeFilterChip(base)
  }, [label, options, selected, summarize])

  const hasSelection = selected.length > 0

  function openMenu(): void {
    if (isDisabled || isLoading) return
    setOpen(true)
  }

  function closeMenu(): void {
    setOpen(false)
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    if (
      event.key === 'Enter' ||
      event.key === ' ' ||
      event.key === 'ArrowDown' ||
      (event.key === 'ArrowDown' && event.altKey)
    ) {
      event.preventDefault()
      openMenu()
    }
  }

  function clearSelection(): void {
    onChange([])
    triggerRef.current?.focus()
  }

  const chipClass = [
    styles.chip,
    'text-body',
    hasSelection ? styles.chipSelected : '',
    isDisabled ? styles.chipDisabled : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={styles.shell}>
      <div className={styles.menuAnchor}>
        <button
          ref={triggerRef}
          id={id}
          type="button"
          className={chipClass}
          disabled={isDisabled || isLoading}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          title={resolvedReason}
          onClick={() => (open ? closeMenu() : openMenu())}
          onKeyDown={handleTriggerKeyDown}
        >
          {isLoading ? (
            <span className={styles.skeletonSummary}>
              <Skeleton region={`${label} filter`} shape="line" width="100%" />
            </span>
          ) : (
            summary
          )}
        </button>

        {resolvedReason !== undefined && isDisabled ? (
          <VisuallyHidden>{resolvedReason}</VisuallyHidden>
        ) : null}

        <FilterChipMenu
          id={menuId}
          options={options}
          selected={selected}
          multiple={multiple}
          open={open}
          onClose={closeMenu}
          onChange={onChange}
          triggerRef={triggerRef}
        />
      </div>

      {hasSelection ? (
        <button
          type="button"
          className={styles.clearChip}
          aria-label={`Clear ${label} filter`}
          onClick={clearSelection}
        >
          <ClearChipIcon />
        </button>
      ) : null}
    </div>
  )
}
