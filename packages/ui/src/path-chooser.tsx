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
        'flex snap-x flex-nowrap gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
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
              'flex flex-1 shrink-0 snap-start items-center gap-3 rounded-lg border border-border bg-surface p-4 text-left transition-colors duration-150 hover:border-border-strong',
              active && 'border-accent bg-accent-soft',
            )}
          >
            <span
              className={cn(
                'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-surface-2 text-faint-foreground transition-colors duration-150',
                active && 'bg-accent text-accent-foreground',
              )}
            >
              {option.icon}
            </span>
            <span className="flex flex-col gap-0.5">
              <span
                className={cn(
                  'text-sm font-heading whitespace-nowrap',
                  active && 'text-accent',
                )}
              >
                {option.label}
              </span>
              <span className="text-2xs leading-caption whitespace-nowrap text-faint-foreground">
                {option.sub}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
