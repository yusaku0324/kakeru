"use client"

import clsx from 'clsx'
import { useMemo } from 'react'

import { ToastContainer } from '@/components/useToast'
import { DashboardReservationFilters } from '@/features/reservations/ui/DashboardReservationFilters'
import { useDashboardReservationFeedState } from '@/features/reservations/usecases/useDashboardReservationFeedState'
import { DashboardReservationToolbar } from '@/features/reservations/ui/DashboardReservationToolbar'
import { ReservationList } from '@/features/reservations/ui/ReservationList'
import { ReservationModal } from '@/features/reservations/ui/ReservationModal'

export default function DashboardReservationFeed({
  profileId,
  slug,
  limit = 8,
  className,
}: {
  profileId: string
  slug?: string | null
  limit?: number
  className?: string
}) {
  const { state, derived, actions, toast } = useDashboardReservationFeedState({ profileId, slug, limit })
  const {
    items,
    total,
    fetchStatus,
    errorMessage,
    isRefreshing,
    isLoadingMore,
    isLoadingPrevious,
    nextCursor,
    prevCursor,
    statusFilter,
    sortBy,
    sortDirection,
    startDate,
    endDate,
    searchInput,
    appliedSearch,
    pageSize,
    activeReservation,
  } = state
  const { conflictIds, filterSummary } = derived
  const {
    refresh,
    handleStatusFilterChange,
    handleSortChange,
    handleDirectionChange,
    handleLimitChange,
    handleStartDateChange,
    handleEndDateChange,
    handleResetDateRange,
    handleSearchInputChange,
    handleSearchSubmit,
    handleClearSearch,
    handleLoadMore,
    handleLoadPrevious,
    openReservation,
    closeReservation,
    decideReservation,
  } = actions
  const { toasts, remove } = toast

  const body = useMemo(() => {
    if (fetchStatus === 'loading' && items.length === 0) {
      return (
        <div className="space-y-3">
          {Array.from({ length: Math.min(3, limit) }).map((_, idx) => (
            <div key={idx} className="animate-pulse rounded-[18px] bg-neutral-100 px-4 py-3">
              <div className="h-3 w-1/2 rounded bg-neutral-200" />
            </div>
          ))}
        </div>
      )
    }

    if (fetchStatus === 'error' && items.length === 0) {
      return (
        <div className="rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {errorMessage ?? '予約リストの取得に失敗しました。時間をおいて再度お試しください。'}
        </div>
      )
    }

    if (items.length === 0) {
      return <p className="text-sm text-neutral-textMuted">予約はまだありません。</p>
    }

    return <ReservationList items={items} conflictIds={conflictIds} onSelect={openReservation} />
  }, [conflictIds, errorMessage, fetchStatus, items, limit, openReservation])

  return (
    <section className={clsx('space-y-5 rounded-xl border border-neutral-borderLight/60 bg-white/90 p-5', className)}>
      <DashboardReservationToolbar
        total={total}
        visibleCount={items.length}
        hasPrevCursor={Boolean(prevCursor)}
        isLoadingPrevious={isLoadingPrevious}
        isRefreshing={isRefreshing}
        onLoadPrevious={() => handleLoadPrevious()}
        onRefresh={() => refresh()}
      />

      <DashboardReservationFilters
        statusFilter={statusFilter}
        sortBy={sortBy}
        sortDirection={sortDirection}
        pageSize={pageSize}
        startDate={startDate}
        endDate={endDate}
        searchInput={searchInput}
        onStatusChange={handleStatusFilterChange}
        onSortChange={handleSortChange}
        onDirectionChange={handleDirectionChange}
        onLimitChange={handleLimitChange}
        onStartDateChange={handleStartDateChange}
        onEndDateChange={handleEndDateChange}
        onResetDateRange={handleResetDateRange}
        onSearchInputChange={handleSearchInputChange}
        onSearchSubmit={handleSearchSubmit}
        onClearSearch={handleClearSearch}
      />

      {body}

      {nextCursor && items.length ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void handleLoadMore()}
            disabled={isLoadingMore}
            className="inline-flex items-center gap-2 rounded-full border border-neutral-borderLight/70 px-4 py-2 text-sm font-semibold text-neutral-text transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoadingMore ? '読み込み中…' : 'さらに読み込む'}
          </button>
        </div>
      ) : null}

      <ToastContainer toasts={toasts} onDismiss={remove} />
      <ReservationModal
        open={Boolean(activeReservation)}
        reservation={activeReservation}
        onClose={closeReservation}
        onApprove={(reservation) => decideReservation(reservation, 'approve')}
        onDecline={(reservation) => decideReservation(reservation, 'decline')}
        filterSummary={filterSummary}
      />
    </section>
  )
}
