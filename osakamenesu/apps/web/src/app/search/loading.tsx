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

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-neutral-borderLight/60 bg-white p-4 shadow-sm">
      <div className="flex gap-4">
        <div className="h-24 w-24 shrink-0 animate-pulse rounded-xl bg-neutral-borderLight/60" />
        <div className="flex-1 space-y-2">
          <TextSkeleton width="60%" height={18} />
          <TextSkeleton width="80%" height={12} />
          <div className="flex gap-2">
            <TextSkeleton width={60} height={20} className="rounded-md" />
            <TextSkeleton width={48} height={20} className="rounded-md" />
          </div>
          <TextSkeleton width="40%" height={12} />
        </div>
      </div>
    </div>
  )
}

function TabsSkeleton() {
  return (
    <div className="flex gap-2">
      <TextSkeleton width={100} height={40} className="rounded-full" />
      <TextSkeleton width={100} height={40} className="rounded-full" />
    </div>
  )
}

function FiltersSkeleton() {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <TextSkeleton key={i} width={80} height={32} className="rounded-full" />
      ))}
    </div>
  )
}

export default function SearchLoading() {
  return (
    <div
      className="min-h-screen bg-neutral-surface"
      aria-busy="true"
      role="status"
      aria-label="検索結果を読み込み中"
    >
      <div className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
        <div className="space-y-6">
          {/* Header skeleton */}
          <div className="space-y-4">
            <TextSkeleton width={200} height={28} />
            <TextSkeleton width="60%" height={14} />
          </div>

          {/* Tabs skeleton */}
          <TabsSkeleton />

          {/* Filters skeleton */}
          <FiltersSkeleton />

          {/* Results skeleton */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
