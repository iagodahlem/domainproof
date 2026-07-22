import type { ReactNode } from 'react'
import Link from 'next/link'
import { Button, Header, Logo, ThemeToggle } from '@domainproof/ui'

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header
        left={<Logo />}
        right={
          <div className="flex items-center gap-3">
            <Button asChild variant="primary" size="sm">
              <Link href="/docs">Docs</Link>
            </Button>
            <ThemeToggle />
          </div>
        }
      />
      {children}
    </>
  )
}
