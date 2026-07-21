'use client'

import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from './cn'

export interface PathChooserOption {
  id: string
  icon: ReactNode
  label: ReactNode
  sub: ReactNode
}

export interface PathChooserProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  options: PathChooserOption[]
  value: string
  onChange: (id: string) => void
}

export function PathChooser({
  options,
  value,
  onChange,
  className,
  ...props
}: PathChooserProps) {
  return (
    <div
      role="tablist"
      className={cn(
        'mb-[var(--space-8)] grid grid-cols-4 gap-[var(--space-3)] max-[780px]:grid-cols-2',
        className,
      )}
      {...props}
    >
      {options.map((option) => {
        const active = option.id === value
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.id)}
            className={cn(
              'flex min-w-0 items-center gap-[var(--space-3)] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-[var(--pad-card)] text-left transition-colors duration-[var(--duration-fast)] hover:border-[var(--border-strong)]',
              active && 'border-[var(--accent)] bg-[var(--accent-soft)]',
            )}
          >
            <span
              className={cn(
                'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface-2)] text-[color:var(--text-faint)] transition-colors duration-[var(--duration-fast)]',
                active &&
                  'bg-[var(--accent)] text-[color:var(--accent-foreground)]',
              )}
            >
              {option.icon}
            </span>
            <span className="flex min-w-0 flex-col gap-[2px]">
              <span
                className={cn(
                  'text-[length:var(--text-sm)] font-[var(--font-weight-heading)]',
                  active && 'text-[color:var(--accent)]',
                )}
              >
                {option.label}
              </span>
              <span className="text-[length:var(--text-2xs)] leading-[var(--leading-caption)] text-[color:var(--text-faint)]">
                {option.sub}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
