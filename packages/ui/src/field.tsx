import type { ReactNode } from 'react'

/** Shared label + inline-error rendering for TextField and Select — not part of the public API. */
export function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string
  children: ReactNode
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-[length:var(--text-sm)] font-[var(--font-weight-medium)] text-[color:var(--text-muted)]"
    >
      {children}
    </label>
  )
}

export function FieldError({
  id,
  children,
}: {
  id: string
  children: ReactNode
}) {
  return (
    <p
      id={id}
      className="text-[length:var(--text-xs)] text-[color:var(--danger)]"
    >
      {children}
    </p>
  )
}
