'use client'

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
import type { ProjectSummary } from '@/lib/api'

export interface ProjectSwitcherProps {
  projects: ProjectSummary[]
  activeProject: ProjectSummary
  className?: string
}

/**
 * Current project name + a dropdown listing every project on the account,
 * "New project" pinned at the bottom (owner-approved board proposal).
 */
export function ProjectSwitcher({
  projects,
  activeProject,
  className,
}: ProjectSwitcherProps) {
  return (
    <Menu>
      <MenuTrigger
        className={cn(
          'flex w-full items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-left text-sm font-semibold text-text transition-colors duration-150 hover:border-border-strong',
          className,
        )}
      >
        <LayoutGrid
          aria-hidden="true"
          size={14}
          className="shrink-0 text-text-faint"
        />
        <span className="flex-1 truncate">{activeProject.name}</span>
        <ChevronDown
          aria-hidden="true"
          size={13}
          className="shrink-0 text-text-faint"
        />
      </MenuTrigger>
      <MenuContent aria-label="Projects">
        {projects.map((project) => (
          <MenuItem
            key={project.id}
            asChild
            active={project.id === activeProject.id}
            icon={<LayoutGrid aria-hidden="true" size={14} />}
          >
            <Link href={`/dashboard/${project.id}/domains`}>
              {project.name}
            </Link>
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem
          asChild
          tone="accent"
          icon={<Plus aria-hidden="true" size={14} />}
        >
          <Link href="/new">New project</Link>
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}
