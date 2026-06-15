import * as React from 'react'
import { cn } from '../../lib/utils'

const statusConfig: Record<string, { dot: string; label: string }> = {
  enrolled: { dot: 'bg-success', label: 'text-success' },
  active: { dot: 'bg-success', label: 'text-success' },
  paid: { dot: 'bg-success', label: 'text-success' },
  pending: { dot: 'bg-warning', label: 'text-warning' },
  overdue: { dot: 'bg-danger', label: 'text-danger' },
  partial: { dot: 'bg-warning', label: 'text-warning' },
  withdrawn: { dot: 'bg-text-subtle', label: 'text-text-muted' },
  archived: { dot: 'bg-text-subtle', label: 'text-text-muted' },
  invited: { dot: 'bg-info', label: 'text-info' },
  suspended: { dot: 'bg-danger', label: 'text-danger' },
  draft: { dot: 'bg-text-subtle', label: 'text-text-muted' },
  published: { dot: 'bg-brand', label: 'text-brand' },
  approved: { dot: 'bg-success', label: 'text-success' },
  rejected: { dot: 'bg-danger', label: 'text-danger' },
  new: { dot: 'bg-info', label: 'text-info' },
  contacted: { dot: 'bg-warning', label: 'text-warning' },
  lost: { dot: 'bg-danger', label: 'text-danger' },
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status.toLowerCase()] ?? { dot: 'bg-text-subtle', label: 'text-text-muted' }
  const label = status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium', config.label, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} />
      {label}
    </span>
  )
}

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'outline' | 'secondary'
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm px-1.5 py-0.5 text-xs font-medium',
        variant === 'default' && 'bg-brand-muted text-brand',
        variant === 'outline' && 'border border-border text-text-muted',
        variant === 'secondary' && 'bg-surface-2 text-text-muted',
        className
      )}
      {...props}
    />
  )
}
