import { Search } from 'lucide-react'
import { Input } from '../ui/input'
import { cn } from '../../lib/utils'

interface FilterBarProps {
  search?: {
    value: string
    onChange: (v: string) => void
    placeholder?: string
  }
  filters?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

export function FilterBar({ search, filters, actions, className }: FilterBarProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {search && (
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-text-subtle" />
          <Input
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder ?? 'Search…'}
            className="pl-8"
          />
        </div>
      )}
      {filters && <div className="flex items-center gap-2">{filters}</div>}
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  )
}
