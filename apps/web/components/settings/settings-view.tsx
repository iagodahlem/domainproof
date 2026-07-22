import type { ApiKeyListItem, ProjectSummary } from '@/lib/api/dashboard'
import { ProjectNameCard } from './project-name-card'
import { ApiKeysCard } from './api-keys-card'

export interface SettingsViewProps {
  project: ProjectSummary
  apiKeys: ApiKeyListItem[]
}

export function SettingsView({ project, apiKeys }: SettingsViewProps) {
  return (
    <div>
      <ProjectNameCard project={project} />
      <ApiKeysCard projectId={project.id} initialKeys={apiKeys} />
    </div>
  )
}
