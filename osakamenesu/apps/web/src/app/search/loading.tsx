import clsx from 'clsx'

type TextSkeletonProps = {
  width?: string | number
  height?: number
  className?: string
  delay?: number
}

function TextSkeleton({ width = '100%', height = 16, className, delay = 0 }: TextSkeletonProps) {
  return (
    <div
      className={clsx('animate-pulse rounded-full bg-neutral-200/70', className)}
      style={{
        width,
        height,
        animationDelay: `${delay}ms`,
      }}
    />
  )
}

function TherapistCardSkeleton({ index = 0 }: { index?: number }) {
  const delay = index * 100
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-borderLight/60 bg-white shadow-sm">
      {/* Image placeholder with 4:3 aspect ratio */}
      <div
        className="aspect-[4/3] animate-pulse bg-gradient-to-br from-neutral-100 to-neutral-200/80"
        style={{ animationDelay: `${delay}ms` }}
      />
      <div className="space-y-3 p-4">
        {/* Name and rating */}
        <div className="flex items-center justify-between">
          <TextSkeleton width="50%" height={20} delay={delay + 50} />
          <TextSkeleton width={40} height={16} delay={delay + 100} />
        </div>
        {/* Headline */}
        <TextSkeleton width="90%" height={14} delay={delay + 150} />
        {/* Tags */}
        <div className="flex gap-2">
          <TextSkeleton width={56} height={22} className="rounded-full" delay={delay + 200} />
          <TextSkeleton width={48} height={22} className="rounded-full" delay={delay + 250} />
          <TextSkeleton width={64} height={22} className="rounded-full" delay={delay + 300} />
        </div>
        {/* Availability badge */}
        <TextSkeleton width={100} height={26} className="rounded-full" delay={delay + 350} />
      </div>
    </div>
  )
}

function ShopCardSkeleton({ index = 0 }: { index?: number }) {
  const delay = index * 100
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-borderLight/60 bg-white shadow-sm">
      {/* Image placeholder */}
      <div
        className="aspect-[16/9] animate-pulse bg-gradient-to-br from-neutral-100 to-neutral-200/80"
        style={{ animationDelay: `${delay}ms` }}
      />
      <div className="space-y-3 p-4">
        {/* Area badge */}
        <TextSkeleton width={80} height={18} className="rounded-full" delay={delay + 50} />
        {/* Shop name */}
        <TextSkeleton width="75%" height={22} delay={delay + 100} />
        {/* Description */}
        <TextSkeleton width="100%" height={14} delay={delay + 150} />
        <TextSkeleton width="60%" height={14} delay={delay + 200} />
        {/* Price and rating */}
        <div className="flex items-center justify-between pt-2">
          <TextSkeleton width={100} height={20} delay={delay + 250} />
          <div className="flex items-center gap-2">
            <TextSkeleton width={60} height={18} delay={delay + 300} />
            <TextSkeleton width={40} height={18} delay={delay + 350} />
          </div>
        </div>
      </div>
    </div>
  )
}

function TabsSkeleton() {
  return (
    <div className="flex gap-2">
      <div
        className="h-10 w-28 animate-pulse rounded-full bg-brand-primary/20"
        style={{ animationDelay: '0ms' }}
      />
      <div
        className="h-10 w-24 animate-pulse rounded-full bg-neutral-200/70"
        style={{ animationDelay: '100ms' }}
      />
    </div>
  )
}

function FiltersSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {[90, 70, 100, 80].map((width, i) => (
          <div
            key={i}
            className="h-9 animate-pulse rounded-full bg-neutral-200/70"
            style={{
              width,
              animationDelay: `${i * 75}ms`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

function HeroSkeleton() {
  return (
    <div className="space-y-4 rounded-2xl border border-neutral-borderLight/40 bg-gradient-to-br from-white to-neutral-50 p-6">
      <div className="flex items-center gap-3">
        <div
          className="h-10 w-10 animate-pulse rounded-full bg-brand-primary/20"
          style={{ animationDelay: '0ms' }}
        />
        <TextSkeleton width={180} height={32} delay={50} />
      </div>
      <TextSkeleton width="70%" height={18} delay={100} />
      <div className="flex gap-3">
        <TextSkeleton width={120} height={40} className="rounded-full" delay={150} />
        <TextSkeleton width={100} height={40} className="rounded-full" delay={200} />
      </div>
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
          {/* Hero skeleton */}
          <HeroSkeleton />

          {/* Tabs skeleton */}
          <TabsSkeleton />

          {/* Filters skeleton */}
          <FiltersSkeleton />

          {/* Results skeleton - mix of therapist and shop cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              i % 2 === 0 ? (
                <TherapistCardSkeleton key={i} index={i} />
              ) : (
                <ShopCardSkeleton key={i} index={i} />
              )
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
