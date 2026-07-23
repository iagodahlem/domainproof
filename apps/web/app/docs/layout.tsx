import type { ReactNode } from 'react'
import { DocsHeader } from './_components/docs-header'

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <DocsHeader />
      {children}
    </div>
  )
}
