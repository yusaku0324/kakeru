import React from 'react'
import clsx from 'clsx'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

type CardProps = {
  children: ReactNode
  as?: 'div' | 'article' | 'section'
  className?: string
  interactive?: boolean
} & Omit<ComponentPropsWithoutRef<'div'>, 'children'>

export function Card({
  children,
  as: Comp = 'article',
  className,
  interactive = false,
  ...rest
}: CardProps) {
  const base = (
    <Comp
      className={clsx(
        'group relative overflow-hidden rounded-card border border-neutral-borderLight bg-neutral-surface shadow-card transition-shadow',
        interactive && 'hover:shadow-cardHover focus-within:shadow-cardHover',
        className,
      )}
      {...rest}
    >
      {children}
    </Comp>
  )
  return base
}

export default Card
