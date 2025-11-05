"use client"

import clsx from 'clsx'
import {
  type KeyboardEvent,
  type ReactNode,
  type HTMLAttributes,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

type Option = {
  value: string
  label: string
  icon?: ReactNode
}

type GlassSelectProps = {
  name?: string
  options: Option[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  label?: string
  icon?: ReactNode
  menuClassName?: string
  buttonClassName?: string
  optionClassName?: string
  ariaLabelledby?: string
}

function useFocusOutline(active: boolean) {
  useEffect(() => {
    if (!active) return
    const previous = document.body.style.pointerEvents
    document.body.style.pointerEvents = 'auto'
    return () => {
      document.body.style.pointerEvents = previous
    }
  }, [active])
}

export function GlassSelect({
  name,
  options,
  value,
  onChange,
  placeholder = '選択してください',
  className,
  disabled = false,
  label,
  icon,
  menuClassName,
  buttonClassName,
  optionClassName,
  ariaLabelledby,
}: GlassSelectProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number>(() => {
    const index = options.findIndex((option) => option.value === value)
    return index >= 0 ? index : 0
  })
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const labelId = useId()
  const listboxId = useId()
  const portalRef = useRef<HTMLDivElement | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 })
  useFocusOutline(open)

  useEffect(() => {
    if (typeof document === 'undefined') return
    const host = document.createElement('div')
    host.setAttribute('data-glass-select-portal', 'true')
    host.style.position = 'absolute'
    host.style.top = '0'
    host.style.left = '0'
    host.style.width = '100%'
    document.body.appendChild(host)
    portalRef.current = host
    return () => {
      document.body.removeChild(host)
      portalRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (containerRef.current && containerRef.current.contains(target)) return
      if (portalRef.current && portalRef.current.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  useEffect(() => {
    const index = options.findIndex((option) => option.value === value)
    if (index >= 0) setActiveIndex(index)
  }, [options, value])

  useEffect(() => {
    if (!open) return
    const listElement = listRef.current
    if (!listElement) return
    const activeElement = listElement.querySelector<HTMLElement>('[data-active="true"]')
    if (activeElement) {
      activeElement.scrollIntoView({ block: 'nearest' })
    }
  }, [open, activeIndex])

  const updateMenuPosition = useCallback(() => {
    const button = buttonRef.current
    if (!button) return
    const rect = button.getBoundingClientRect()
    const OFFSET = 8
    setMenuPosition({ top: rect.bottom + OFFSET, left: rect.left, width: rect.width })
  }, [])

  useEffect(() => {
    if (!open) return
    updateMenuPosition()
    const handleScroll = () => updateMenuPosition()
    const handleResize = () => updateMenuPosition()
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleResize)
    }
  }, [open, updateMenuPosition])


  const currentOption = useMemo(() => options.find((option) => option.value === value) ?? null, [value, options])

  const handleSelect = useCallback(
    (nextValue: string) => {
      onChange(nextValue)
      setOpen(false)
      buttonRef.current?.focus()
    },
    [onChange],
  )

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    if (event.key === ' ' || event.key === 'Enter' || event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((prev) => {
        if (!options.length) return 0
        const index = options.findIndex((option) => option.value === value)
        if (index >= 0) return index
        return prev
      })
    }
  }

  const handleListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      buttonRef.current?.focus()
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((prev) => Math.min(prev + 1, options.length - 1))
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((prev) => Math.max(prev - 1, 0))
    }
    if (event.key === 'Home') {
      event.preventDefault()
      setActiveIndex(0)
    }
    if (event.key === 'End') {
      event.preventDefault()
      setActiveIndex(Math.max(options.length - 1, 0))
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const option = options[activeIndex]
      if (option) handleSelect(option.value)
    }
  }

  return (
    <div ref={containerRef} className={clsx('relative', className)}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-labelledby={ariaLabelledby ?? (label ? labelId : undefined)}
        aria-controls={listboxId}
        onClick={() => {
          if (disabled) return
          setOpen((prev) => !prev)
        }}
        onKeyDown={handleKeyDown}
        className={clsx(
          'group flex w-full items-center justify-between gap-3 rounded-full border border-white/60 bg-white/65 px-4 py-2.5 text-sm font-semibold text-neutral-text shadow-[0_16px_36px_rgba(37,99,235,0.12)] backdrop-blur transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 disabled:cursor-not-allowed disabled:opacity-60',
          buttonClassName,
          open && 'border-brand-primary/40 bg-white/80 shadow-[0_20px_48px_rgba(37,99,235,0.18)]',
        )}
      >
        <span className="flex items-center gap-2 truncate">
          {icon ? <span className="text-brand-primary">{icon}</span> : null}
          <span className={clsx('truncate', !currentOption && 'text-neutral-textMuted')}>
            {currentOption?.label ?? placeholder}
          </span>
        </span>
        <span
          className={clsx(
            'inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/60 bg-white/80 text-sm text-brand-primary transition',
            open && 'border-brand-primary bg-brand-primary text-white shadow-[0_12px_28px_rgba(37,99,235,0.22)]',
          )}
          aria-hidden
        >
          {open ? '▴' : '▾'}
        </span>
      </button>
      {name ? <input type="hidden" name={name} value={value} /> : null}

      {open && portalRef.current
        ? createPortal(
            <ul
              ref={listRef}
              id={listboxId}
              role="listbox"
              tabIndex={-1}
              aria-labelledby={ariaLabelledby ?? (label ? labelId : undefined)}
              className={clsx(
                'fixed z-[1200] max-h-64 overflow-y-auto rounded-[28px] border border-white/70 bg-white/95 p-2 shadow-[0_32px_80px_rgba(37,99,235,0.28)] backdrop-blur',
                menuClassName,
              )}
              style={{
                top: menuPosition.top,
                left: menuPosition.left,
                width: menuPosition.width,
              }}
              onKeyDown={handleListKeyDown}
            >
              {options.map((option, index) => {
                const active = index === activeIndex
                const selected = option.value === value
                return (
                  <li
                    key={option.value}
                    role="option"
                    aria-selected={selected}
                    data-active={active ? 'true' : undefined}
                    className={clsx(
                      'relative flex cursor-pointer items-center justify-between gap-3 rounded-[22px] px-4 py-3 text-sm font-semibold text-neutral-text transition hover:bg-brand-primary/8 focus:bg-brand-primary/8',
                      selected && 'bg-brand-primary/12 text-brand-primary',
                      active && !selected && 'ring-2 ring-brand-primary/20',
                      optionClassName,
                    )}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => handleSelect(option.value)}
                  >
                    <span className="flex items-center gap-2">
                      {option.icon ? <span className="text-brand-primary">{option.icon}</span> : null}
                      {option.label}
                    </span>
                    {selected ? (
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-primary text-xs font-semibold text-white shadow-[0_8px_18px_rgba(37,99,235,0.22)]">
                        ✓
                      </span>
                    ) : null}
                  </li>
                )
              })}
            </ul>,
            portalRef.current,
          )
        : null}
    </div>
  )
}

type GlassSelectWrapperProps = GlassSelectProps & { label?: string; hint?: string } & Omit<
  HTMLAttributes<HTMLDivElement>,
  keyof GlassSelectProps | 'children'
>

export function GlassSelectField({ label, hint, className, ...props }: GlassSelectWrapperProps) {
  const labelId = useId()
  return (
    <div className={clsx('space-y-2', className)}>
      {label ? (
        <label id={labelId} className="text-sm font-semibold text-neutral-text">
          {label}
        </label>
      ) : null}
      <GlassSelect ariaLabelledby={label ? labelId : undefined} {...props} />
      {hint ? <p className="text-[11px] text-neutral-textMuted">{hint}</p> : null}
    </div>
  )
}
