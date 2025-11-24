'use client'

import { useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import clsx from 'clsx'

type Option = {
  value: string
  label: string
}

type ResultsSortControlProps = {
  options: ReadonlyArray<Option>
  currentSort?: string
  hashTarget?: string
}

const SELECT_CLASS =
  'rounded-full border border-neutral-borderLight bg-white px-4 py-2 text-sm font-semibold text-neutral-text shadow-[0_6px_20px_rgba(15,23,42,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary'

export function ResultsSortControl({
  options,
  currentSort = 'recommended',
  hashTarget = 'search-results',
}: ResultsSortControlProps) {
  const router = useRouter()
  const pathname = usePathname() || '/search'
  const searchParams = useSearchParams()

  const normalizedParams = useMemo(
    () => new URLSearchParams(searchParams?.toString() ?? ''),
    [searchParams],
  )

  const handleChange = (value: string) => {
    const params = new URLSearchParams(normalizedParams.toString())
    if (!value || value === 'recommended') {
      params.delete('sort')
    } else {
      params.set('sort', value)
    }
    const qs = params.toString()
    const target = `${pathname}${qs ? `?${qs}` : ''}#${hashTarget}`
    router.replace(target, { scroll: false })
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        document.getElementById(hashTarget)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }

  return (
    <label className="flex items-center gap-2 text-xs font-semibold text-neutral-text">
      並び替え
      <select
        className={clsx(SELECT_CLASS)}
        value={currentSort}
        onChange={(event) => handleChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
