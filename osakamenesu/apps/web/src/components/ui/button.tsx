import { forwardRef } from 'react'
import clsx from 'clsx'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          {
            // Variants
            'bg-brand-primary text-white hover:bg-brand-primary/90': variant === 'primary',
            'bg-neutral-surfaceSub text-neutral-text hover:bg-neutral-surfaceLight': variant === 'secondary',
            'border border-neutral-borderLight bg-transparent hover:bg-neutral-surface': variant === 'outline',
            'hover:bg-neutral-surface hover:text-neutral-text': variant === 'ghost',
            // Sizes
            'h-8 px-3 text-sm': size === 'sm',
            'h-10 px-4 text-sm': size === 'md',
            'h-12 px-6': size === 'lg',
          },
          'rounded-lg',
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export { Button }
