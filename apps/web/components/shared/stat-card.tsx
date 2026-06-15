import { cn } from '../../lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  delta?: { value: string; direction: 'up' | 'down' | 'flat' }
  sub?: string
  className?: string
}

export function StatCard({ label, value, delta, sub, className }: StatCardProps) {
  return (
    <div className={cn('rounded-lg border border-border bg-surface-raised p-4 flex flex-col gap-2', className)}>
      <span className="text-xs font-medium text-text-muted uppercase tracking-wide">{label}</span>
      <div className="flex items-end justify-between gap-2">
        <span className="text-3xl font-semibold text-text tabular-nums">{value}</span>
        {delta && (
          <span className={cn('flex items-center gap-0.5 text-xs font-medium mb-1',
            delta.direction === 'up' ? 'text-success' : delta.direction === 'down' ? 'text-danger' : 'text-text-muted'
          )}>
            {delta.direction === 'up' ? <TrendingUp className="h-3 w-3" /> : delta.direction === 'down' ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {delta.value}
          </span>
        )}
      </div>
      {sub && <span className="text-xs text-text-muted">{sub}</span>}
    </div>
  )
}
