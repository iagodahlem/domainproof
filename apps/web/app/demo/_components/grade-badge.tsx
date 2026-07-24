import { cva } from 'class-variance-authority'
import { cn } from '@domainproof/ui'
import type { Grade } from '../_lib/grade'

const gradeBadgeVariants = cva(
  'flex h-13.5 w-13.5 shrink-0 items-center justify-center rounded-full font-sg-display text-xl',
  {
    variants: {
      tier: {
        good: 'bg-sg-sage-soft text-sg-sage-text',
        fair: 'bg-sg-amber-soft text-sg-amber-text',
        poor: 'bg-sg-red-soft text-sg-red-text',
      },
    },
  },
)

const GRADE_TIER: Record<Grade, 'good' | 'fair' | 'poor'> = {
  A: 'good',
  B: 'good',
  C: 'fair',
  D: 'fair',
  F: 'poor',
}

export function GradeBadge({ grade }: { grade: Grade }) {
  return (
    <div className={cn(gradeBadgeVariants({ tier: GRADE_TIER[grade] }))}>
      {grade}
    </div>
  )
}
