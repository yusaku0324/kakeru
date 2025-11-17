import clsx from 'clsx'

type TextSkeletonProps = {
  width?: string | number
  height?: number
  className?: string
}

function TextSkeleton({ width = '100%', height = 16, className }: TextSkeletonProps) {
  return (
    <div
      className={clsx('rounded-full bg-neutral-borderLight/60', className)}
      style={{ width, height }}
    />
  )
}

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-brand-primary/20 bg-white/80 px-4 py-3 shadow-[0_16px_50px_rgba(37,99,235,0.12)]">
      <div className="space-y-2">
        <TextSkeleton width="70%" height={14} />
        <TextSkeleton width="45%" height={12} />
        <div className="flex gap-2">
          <TextSkeleton width={60} height={12} className="bg-neutral-borderLight/70" />
          <TextSkeleton width={48} height={12} className="bg-neutral-borderLight/70" />
        </div>
        <TextSkeleton width="90%" height={12} className="bg-brand-primary/30" />
      </div>
    </div>
  )
}

function SearchAvailableTodaySkeleton() {
  return (
    <section className="rounded-section border border-white/60 bg-white/80 p-6 shadow-lg shadow-brand-primary/5 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <TextSkeleton width={140} />
          <TextSkeleton width={220} height={12} />
        </div>
        <TextSkeleton width={60} height={18} className="bg-brand-primary/30" />
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, idx) => (
          <CardSkeleton key={idx} />
        ))}
      </div>
    </section>
  )
}

function SectionSkeleton() {
  return (
    <section className="rounded-section border border-neutral-borderLight/70 bg-white/85 p-6 shadow-lg shadow-neutral-950/5 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="space-y-2">
        <TextSkeleton width={180} />
        <TextSkeleton width={260} height={12} />
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="rounded-2xl border border-neutral-borderLight/60 bg-neutral-surface px-4 py-6">
            <TextSkeleton width="60%" />
            <TextSkeleton width="80%" height={12} className="mt-3" />
            <TextSkeleton width="40%" height={12} className="mt-2" />
          </div>
        ))}
      </div>
    </section>
  )
}

export default function Loading() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-neutral-surface" aria-busy>
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(147,197,253,0.18),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(196,181,253,0.16),_transparent_50%)]"
        aria-hidden
      />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 lg:px-6">
        <header className="space-y-4 rounded-section border border-white/60 bg-white/75 px-6 py-8 shadow-xl shadow-brand-primary/5 backdrop-blur supports-[backdrop-filter]:bg-white/65">
          <div className="space-y-3">
            <TextSkeleton width={120} height={18} className="bg-brand-primary/30" />
            <TextSkeleton width="60%" height={28} />
            <TextSkeleton width="90%" />
            <TextSkeleton width="80%" />
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 3 }).map((_, idx) => (
              <TextSkeleton key={idx} width={140} height={20} className="bg-brand-primary/20" />
            ))}
          </div>
        </header>

        <SearchAvailableTodaySkeleton />

        <nav className="flex flex-wrap gap-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <TextSkeleton key={idx} width={140} height={28} />
          ))}
        </nav>

        <SectionSkeleton />
        <SectionSkeleton />
      </div>
    </main>
  )
}
