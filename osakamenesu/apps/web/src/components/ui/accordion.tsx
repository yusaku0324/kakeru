'use client'

import * as React from 'react'
import * as AccordionPrimitive from '@radix-ui/react-accordion'
import clsx from 'clsx'

const Accordion = AccordionPrimitive.Root

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => ( //
  <AccordionPrimitive.Item
    ref={ref}
    className={clsx(
      'rounded-2xl border border-neutral-borderLight/80 bg-white/80 shadow-sm',
      className,
    )}
    {...props}
  />
))
AccordionItem.displayName = 'AccordionItem'

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => ( //
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={clsx(
        'flex flex-1 items-center justify-between gap-3 rounded-2xl px-5 py-4 text-left text-sm font-semibold text-neutral-text transition hover:text-brand-primary focus:outline-none',
        className,
      )}
      {...props}
    >
      {children}
      <span className="ml-2 text-lg text-neutral-textMuted transition duration-200 [data-state=open]:rotate-45">
        ＋
      </span>
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
))
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => ( //
  <AccordionPrimitive.Content
    ref={ref}
    className={clsx(
      'overflow-hidden border-t border-neutral-borderLight/70 px-5 py-4 text-neutral-text data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down',
      className,
    )}
    {...props}
  >
    {children}
  </AccordionPrimitive.Content>
))
AccordionContent.displayName = AccordionPrimitive.Content.displayName

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
