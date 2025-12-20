import clsx from 'clsx'

type TextSkeletonProps = {
  width?: string | number
  height?: number
  className?: string
}

function TextSkeleton({ width = '100%', height = 16, className }: TextSkeletonProps) {
  return (
    <div
      className={clsx('animate-pulse rounded-full bg-neutral-borderLight/60', className)}
      style={{ width, height }}
    />
  )
}

function ReservationCardSkeleton() {
  return (
    <div className="rounded-2xl border border-neutral-borderLight/60 bg-white p-4 shadow-sm">
      <div className="flex gap-4">
        <div className="h-16 w-16 shrink-0 animate-pulse rounded-full bg-neutral-borderLight/60" />
        <div className="flex-1 space-y-2">
          <TextSkeleton width="50%" height={16} />
          <TextSkeleton width="70%" height={12} />
          <TextSkeleton width="40%" height={12} />
        </div>
      </div>
    </div>
  )
}

export default function GuestLoading() {
  return (
    <div
      className="min-h-screen bg-neutral-surface"
      aria-busy="true"
      role="status"
      aria-label="ゲストページを読み込み中"
    >
      <div className="mx-auto max-w-4xl px-4 py-6 lg:px-6">
        <div className="space-y-6">
          {/* Header skeleton */}
          <div className="space-y-2">
            <TextSkeleton width={180} height={24} />
            <TextSkeleton width="50%" height={14} />
          </div>

          {/* Reservation cards skeleton */}
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <ReservationCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
