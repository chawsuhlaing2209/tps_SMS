import { cn } from '../../lib/utils'
import { Separator } from '../ui/separator'

interface PageHeaderProps {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function PageHeader({ title, description, action, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">{title}</h1>
          {description && <p className="text-base text-text-muted mt-0.5">{description}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
      <Separator className="mt-3" />
    </div>
  )
}
