import clsx from 'clsx'

type AlertVariant = 'error' | 'warning' | 'success' | 'info'

type AlertProps = {
  variant?: AlertVariant
  title?: string
  children: React.ReactNode
  className?: string
  onDismiss?: () => void
}

const variantStyles: Record<AlertVariant, string> = {
  error: 'border-red-200 bg-red-50 text-red-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  success: 'border-green-200 bg-green-50 text-green-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
}

const variantIcons: Record<AlertVariant, string> = {
  error: '!',
  warning: '!',
  success: '✓',
  info: 'i',
}

export function Alert({ variant = 'info', title, children, className, onDismiss }: AlertProps) {
  return (
    <div
      className={clsx('relative rounded-md border px-4 py-3', variantStyles[variant], className)}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <span
          className={clsx(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold',
            {
              'bg-red-200 text-red-700': variant === 'error',
              'bg-amber-200 text-amber-700': variant === 'warning',
              'bg-green-200 text-green-700': variant === 'success',
              'bg-blue-200 text-blue-700': variant === 'info',
            }
          )}
        >
          {variantIcons[variant]}
        </span>
        <div className="flex-1">
          {title && <p className="mb-1 font-medium">{title}</p>}
          <div className="text-sm">{children}</div>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 text-current opacity-70 hover:opacity-100"
            aria-label="閉じる"
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}

type ErrorAlertProps = {
  message: string
  onRetry?: () => void
  className?: string
}

export function ErrorAlert({ message, onRetry, className }: ErrorAlertProps) {
  return (
    <Alert variant="error" className={className}>
      <div className="flex items-center justify-between gap-4">
        <span>{message}</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 rounded bg-red-100 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-200"
          >
            再試行
          </button>
        )}
      </div>
    </Alert>
  )
}
