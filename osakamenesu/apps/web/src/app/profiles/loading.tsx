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

function ProfileCardSkeleton() {
  return (
    <div className="rounded-2xl border border-neutral-borderLight/60 bg-white overflow-hidden shadow-sm">
      <div className="h-48 w-full animate-pulse bg-neutral-borderLight/60" />
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-neutral-borderLight/60" />
          <div className="flex-1 space-y-2">
            <TextSkeleton width="60%" height={18} />
            <TextSkeleton width="40%" height={12} />
          </div>
        </div>
        <TextSkeleton width="80%" height={12} />
        <div className="flex gap-2">
          <TextSkeleton width={60} height={20} className="rounded-md" />
          <TextSkeleton width={60} height={20} className="rounded-md" />
        </div>
      </div>
    </div>
  )
}

export default function ProfilesLoading() {
  return (
    <div
      className="min-h-screen bg-neutral-surface"
      aria-busy="true"
      role="status"
      aria-label="プロフィール一覧を読み込み中"
    >
      <div className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
        <div className="space-y-6">
          {/* Header skeleton */}
          <div className="space-y-2">
            <TextSkeleton width={200} height={28} />
            <TextSkeleton width="50%" height={14} />
          </div>

          {/* Profile cards grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <ProfileCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
