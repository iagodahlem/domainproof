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
        'mb-8 flex flex-wrap gap-3 max-[780px]:flex-col',
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
              'flex shrink-0 items-center gap-3 rounded-lg border border-border bg-surface p-5 text-left transition-colors duration-150 hover:border-border-strong max-[780px]:w-full',
              active && 'border-accent bg-accent-soft',
            )}
          >
            <span
              className={cn(
                'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-surface-2 text-text-faint transition-colors duration-150',
                active && 'bg-accent text-accent-foreground',
              )}
            >
              {option.icon}
            </span>
            <span className="flex flex-col gap-[2px]">
              <span
                className={cn(
                  'text-sm font-heading whitespace-nowrap',
                  active && 'text-accent',
                )}
              >
                {option.label}
              </span>
              <span className="text-2xs leading-caption whitespace-nowrap text-text-faint">
                {option.sub}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
