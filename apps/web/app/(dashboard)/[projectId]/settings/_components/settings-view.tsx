import type { ProjectSummary } from '@/lib/api/dashboard'
import { ProjectNameCard } from './project-name-card'
import { ApiKeysCard } from './api-keys-card'

export interface SettingsViewProps {
  project: ProjectSummary
}

export function SettingsView({ project }: SettingsViewProps) {
  return (
    <div>
      <ProjectNameCard project={project} />
      <ApiKeysCard projectId={project.id} />
    </div>
  )
}
