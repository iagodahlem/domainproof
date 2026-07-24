'use client'

import { cva } from 'class-variance-authority'
import Link from 'next/link'
import { ChevronDown, LayoutGrid, Plus } from 'lucide-react'
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  cn,
} from '@domainproof/ui'
import type { ProjectSummary } from '@/lib/api/dashboard'

const triggerVariants = cva(
  'flex items-center rounded-md border border-border bg-surface-2 text-left font-semibold text-foreground transition-colors duration-150 hover:border-border-strong',
  {
    variants: {
      compact: {
        // Icon + chevron only, no name — for the mobile strip, next to the
        // logo, where 4 nav icons and the account menu already compete for
        // width. Matches the mobile strip's own icon-only nav labels.
        true: 'shrink-0 gap-1 p-1.5',
        false: 'w-full gap-2 px-3 py-2 text-sm',
      },
    },
    defaultVariants: {
      compact: false,
    },
  },
)

export interface ProjectSwitcherProps {
  projects: ProjectSummary[]
  activeProject: ProjectSummary
  className?: string
  /** Icon + truncated name in a narrower trigger — for the dashboard's mobile strip, next to the logo. The dropdown menu itself is unchanged. */
  compact?: boolean
}

/**
 * Current project name + a dropdown listing every project on the account,
 * "New project" pinned at the bottom (owner-approved board proposal).
 */
export function ProjectSwitcher({
  projects,
  activeProject,
  className,
  compact = false,
}: ProjectSwitcherProps) {
  return (
    <Menu>
      <MenuTrigger
        aria-label={
          compact
            ? `Switch project — currently ${activeProject.name}`
            : undefined
        }
        className={cn(triggerVariants({ compact }), className)}
      >
        <LayoutGrid
          aria-hidden="true"
          size={compact ? 13 : 14}
          className="shrink-0 text-faint-foreground"
        />
        {compact ? null : (
          <span className="min-w-0 flex-1 truncate">{activeProject.name}</span>
        )}
        <ChevronDown
          aria-hidden="true"
          size={compact ? 12 : 13}
          className="shrink-0 text-faint-foreground"
        />
      </MenuTrigger>
      <MenuContent aria-label="Projects">
        {projects.map((project) => (
          <MenuItem
            key={project.id}
            asChild
            active={project.id === activeProject.id}
            icon={<LayoutGrid aria-hidden="true" size={14} />}
            secondary={project.slug}
          >
            <Link href={`/${project.id}`}>{project.name}</Link>
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem
          asChild
          tone="accent"
          icon={<Plus aria-hidden="true" size={14} />}
        >
          <Link href={`/new?from=${activeProject.id}`}>New project</Link>
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}
