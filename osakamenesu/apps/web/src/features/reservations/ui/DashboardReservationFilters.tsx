"use client"

import type { FormEvent } from 'react'

const noop = () => {}

export type DashboardReservationFiltersProps = {
  statusFilter: (typeof STATUS_OPTIONS)[number]['value']
  sortBy: (typeof SORT_OPTIONS)[number]['value']
  sortDirection: 'desc' | 'asc'
  pageSize: number
  startDate: string
  endDate: string
  searchInput: string
  onStatusChange?: (value: (typeof STATUS_OPTIONS)[number]['value']) => void
  onSortChange?: (value: (typeof SORT_OPTIONS)[number]['value']) => void
  onDirectionChange?: (value: 'desc' | 'asc') => void
  onLimitChange?: (value: number) => void
  onStartDateChange?: (value: string) => void
  onEndDateChange?: (value: string) => void
  onResetDateRange?: () => void
  onSearchInputChange?: (value: string) => void
  onSearchSubmit?: (event: FormEvent<HTMLFormElement>) => void
  onClearSearch?: () => void
}

export const STATUS_OPTIONS = [
  { value: 'all', label: 'すべて' },
  { value: 'pending', label: '承認待ち' },
  { value: 'confirmed', label: '承認済み' },
  { value: 'declined', label: '辞退済み' },
  { value: 'cancelled', label: 'キャンセル' },
  { value: 'expired', label: '期限切れ' },
] as const

export const SORT_OPTIONS = [
  { value: 'latest', label: '受付日時' },
  { value: 'date', label: '希望日時' },
] as const

export const DIRECTION_OPTIONS = [
  { value: 'desc', label: '新しい順' },
  { value: 'asc', label: '古い順' },
] as const

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

export function DashboardReservationFilters({
  statusFilter,
  sortBy,
  sortDirection,
  pageSize,
  startDate,
  endDate,
  searchInput,
  onStatusChange = noop,
  onSortChange = noop,
  onDirectionChange = noop,
  onLimitChange = noop,
  onStartDateChange = noop,
  onEndDateChange = noop,
  onResetDateRange = noop,
  onSearchInputChange = noop,
  onSearchSubmit = noop,
  onClearSearch = noop,
}: DashboardReservationFiltersProps) {
  return (
    <>
      <div className="flex flex-wrap gap-3 text-xs text-neutral-600">
        <label className="flex items-center gap-2">
          <span className="font-semibold">ステータス</span>
          <select
            value={statusFilter}
            onChange={(event) => onStatusChange(event.target.value as (typeof STATUS_OPTIONS)[number]['value'])}
            className="rounded-full border border-neutral-300 bg-white px-2 py-1 text-xs"
          >
            {STATUS_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span className="font-semibold">並び替え</span>
          <select
            value={sortBy}
            onChange={(event) => onSortChange(event.target.value as (typeof SORT_OPTIONS)[number]['value'])}
            className="rounded-full border border-neutral-300 bg-white px-2 py-1 text-xs"
          >
            {SORT_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span className="font-semibold">順序</span>
          <select
            value={sortDirection}
            onChange={(event) => onDirectionChange(event.target.value as 'desc' | 'asc')}
            className="rounded-full border border-neutral-300 bg-white px-2 py-1 text-xs"
          >
            {DIRECTION_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span className="font-semibold">表示件数</span>
          <select
            value={pageSize}
            onChange={(event) => onLimitChange(Number.parseInt(event.target.value, 10))}
            className="rounded-full border border-neutral-300 bg-white px-2 py-1 text-xs"
          >
            {PAGE_SIZE_OPTIONS.map(option => (
              <option key={option} value={option}>
                {option} 件
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-2">
          <span className="font-semibold">期間</span>
          <input
            type="date"
            value={startDate}
            onChange={(event) => onStartDateChange(event.target.value)}
            className="rounded-full border border-neutral-300 px-3 py-1 text-xs focus:border-brand-primary focus:outline-none"
            aria-label="開始日"
          />
          <span className="text-neutral-400">〜</span>
          <input
            type="date"
            value={endDate}
            onChange={(event) => onEndDateChange(event.target.value)}
            className="rounded-full border border-neutral-300 px-3 py-1 text-xs focus:border-brand-primary focus:outline-none"
            aria-label="終了日"
          />
          <button
            type="button"
            onClick={onResetDateRange}
            className="rounded-full border border-neutral-300 px-2 py-1 text-xs text-neutral-500 transition hover:bg-neutral-100"
          >
            期間リセット
          </button>
        </div>
      </div>

      <form onSubmit={onSearchSubmit} className="flex items-center gap-2">
        <input
          type="search"
          value={searchInput}
          onChange={(event) => onSearchInputChange(event.target.value)}
          placeholder="顧客名・電話・メールで検索"
          className="w-48 rounded-full border border-neutral-300 px-3 py-1 text-xs focus:border-brand-primary focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-full border border-brand-primary/40 px-3 py-1 text-xs font-semibold text-brand-primary transition hover:bg-brand-primary/10"
        >
          検索
        </button>
        <button
          type="button"
          onClick={onClearSearch}
          className="rounded-full border border-neutral-300 px-2 py-1 text-xs text-neutral-500 transition hover:bg-neutral-100"
        >
          クリア
        </button>
      </form>
    </>
  )
}
