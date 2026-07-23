import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Card, CardBody } from '@domainproof/ui'

export interface OverviewLinkCardProps {
  href: string
  icon: LucideIcon
  title: string
  description: string
}

/** A compact nav shortcut, not a stats card — Domains is the only one with a live count, Events/Webhooks just orient a first-time visitor toward what's there. */
export function OverviewLinkCard({
  href,
  icon: Icon,
  title,
  description,
}: OverviewLinkCardProps) {
  return (
    <Link href={href} className="group block">
      <Card className="transition-colors duration-150 hover:border-border-strong">
        <CardBody className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-soft text-accent">
              <Icon aria-hidden="true" size={16} />
            </span>
            <ArrowRight
              aria-hidden="true"
              size={14}
              className="text-faint-foreground transition-transform duration-150 group-hover:translate-x-0.5"
            />
          </div>
          <div>
            <h3 className="text-sm font-heading text-foreground">{title}</h3>
            <p className="mt-1 text-xs leading-body text-muted-foreground">
              {description}
            </p>
          </div>
        </CardBody>
      </Card>
    </Link>
  )
}
