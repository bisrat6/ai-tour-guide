import type { ReactElement } from 'react'

import styles from './Skeleton.module.css'

import type { SkeletonProps } from './State.types.ts'

const SHAPE_CLASS: Readonly<Record<NonNullable<SkeletonProps['shape']>, string>> = {
  text: styles.text,
  line: styles.line,
  block: styles.block,
  pill: styles.pill,
  circle: styles.circle,
}

function SkeletonBar({
  shape,
  width,
  height,
}: {
  readonly shape: NonNullable<SkeletonProps['shape']>
  readonly width?: string | undefined
  readonly height?: string | undefined
}): ReactElement {
  const style =
    width !== undefined || height !== undefined
      ? {
          ...(width !== undefined ? { inlineSize: width } : {}),
          ...(height !== undefined ? { blockSize: height } : {}),
        }
      : undefined

  return (
    <span
      className={`${styles.root} ${SHAPE_CLASS[shape]}`}
      style={style}
      aria-hidden="true"
    >
      <span className={styles.sheen} aria-hidden="true" />
    </span>
  )
}

/** Loading placeholder bound to --surface-sunken until skeleton tokens land in W0b. */
export function Skeleton({
  region,
  shape = 'text',
  lines = 1,
  width,
  height,
}: SkeletonProps): ReactElement {
  const label = `Loading ${region}`

  if (lines <= 1) {
    return (
      <span role="status" aria-busy="true" aria-label={label}>
        <SkeletonBar shape={shape} width={width} height={height} />
      </span>
    )
  }

  return (
    <span role="status" aria-busy="true" aria-label={label} className={styles.stack}>
      {Array.from({ length: lines }, (_, index) => (
        <SkeletonBar key={index} shape={shape} width={width} height={height} />
      ))}
    </span>
  )
}
