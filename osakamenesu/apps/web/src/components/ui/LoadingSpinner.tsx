import clsx from 'clsx'

type LoadingSpinnerProps = {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  label?: string
}

const sizeClasses = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-3',
}

export function LoadingSpinner({ size = 'md', className, label }: LoadingSpinnerProps) {
  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <div
        className={clsx(
          'animate-spin rounded-full border-gray-300 border-t-blue-600',
          sizeClasses[size]
        )}
        role="status"
        aria-label={label ?? '読み込み中'}
      />
      {label && <span className="text-sm text-gray-600">{label}</span>}
    </div>
  )
}

type LoadingOverlayProps = {
  label?: string
}

export function LoadingOverlay({ label = '読み込み中...' }: LoadingOverlayProps) {
  return (
    <div className="flex min-h-[200px] items-center justify-center">
      <LoadingSpinner size="lg" label={label} />
    </div>
  )
}

type LoadingPageProps = {
  label?: string
}

export function LoadingPage({ label = '読み込み中...' }: LoadingPageProps) {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <LoadingSpinner size="lg" label={label} />
    </div>
  )
}
