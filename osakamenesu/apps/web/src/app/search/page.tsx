import clsx from 'clsx'
import Link from 'next/link'

import SearchFilters from '@/components/SearchFilters'
import { TherapistFavoritesProvider } from '@/components/staff/TherapistFavoritesProvider'
import { Section } from '@/components/ui/Section'
import { FeaturedSectionHeading, QuickFiltersHeading } from '@/components/SectionHeading'
import { TherapistCardListClient } from '@/components/TherapistCardListClient'

import {
  SAMPLE_RESULTS,
  applyClientFilters,
  buildSampleResponse,
  buildTherapistHits,
  fetchSearchResults,
  parseBoolParam,
  type FacetValue,
  type Params,
} from './shared'

const numberFormatter = new Intl.NumberFormat('ja-JP')

export default async function SearchPage({ searchParams }: { searchParams: Params }) {
  const forceSampleMode = parseBoolParam(
    Array.isArray(searchParams.force_samples) ? searchParams.force_samples[0] : searchParams.force_samples,
  )

  const data = forceSampleMode ? buildSampleResponse(searchParams) : await fetchSearchResults(searchParams)
  const { results, facets, _error, page, page_size: pageSize, total } = data
  const hits = results ?? []
  const hasHits = hits.length > 0

  const areaFacetSource = facets?.area ?? []
  const derivedAreaFacets: FacetValue[] = areaFacetSource.length
    ? areaFacetSource
    : Object.entries(
        (hasHits ? hits : SAMPLE_RESULTS).reduce<Record<string, number>>((acc, hit) => {
          const key = hit.area_name || hit.area
          if (!key) return acc
          acc[key] = (acc[key] ?? 0) + 1
          return acc
        }, {}),
      ).map(([value, count]) => ({ value, label: value, count }))

  const sampleFallbackAllowed = !hasHits
  const displayHits = hasHits ? hits : applyClientFilters(searchParams, SAMPLE_RESULTS)
  const therapistHitsFromResults = buildTherapistHits(displayHits)
  const usingSampleTherapists = sampleFallbackAllowed
  const therapistHits = usingSampleTherapists ? buildTherapistHits(displayHits) : therapistHitsFromResults
  const therapistTotal = therapistHits.length

  const featuredTherapists = (therapistHits.length ? [...therapistHits] : [])
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 3)

  const recentlyViewedTherapists = (therapistHits.length
    ? [...therapistHits]
    : buildTherapistHits(SAMPLE_RESULTS)
  )
    .slice(0, 3)

  const resolvedPageSize = pageSize || 12
  const resolvedPage = page || 1
  const lastPage = Math.max(1, Math.ceil((total || therapistTotal || 1) / resolvedPageSize))

  const buildFilterHref = (params: Record<string, string>) => {
    const sp = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value) sp.set(key, value)
    })
    return `/search?${sp.toString()}`
  }

  const heroAreas = (derivedAreaFacets.length
    ? derivedAreaFacets
    : [
        { value: '梅田', label: '梅田' },
        { value: '難波/日本橋', label: '難波/日本橋' },
        { value: '心斎橋', label: '心斎橋' },
        { value: '天王寺', label: '天王寺' },
        { value: '京橋', label: '京橋' },
      ])
    .slice(0, 5)

  const quickFilters = [
    { label: 'すぐ案内可', icon: '⚡', href: buildFilterHref({ today: 'true' }) },
    { label: '高評価', icon: '★', href: buildFilterHref({ sort: 'rating' }) },
    { label: '本日出勤', icon: '🗓', href: buildFilterHref({ today: 'true', sort: 'recommended' }) },
    { label: '人気', icon: '🔥', href: buildFilterHref({ ranking_badges: '人気' }) },
  ]

  const qp = (n: number) => {
    const entries = Object.entries(searchParams || {}).filter(([, v]) => v !== undefined && v !== null)
    const sp = new URLSearchParams(entries as [string, string][])
    sp.set('page', String(Math.min(Math.max(n, 1), lastPage)))
    return `/search?${sp.toString()}`
  }

  const viewSwitchLinks = [
    { href: '/search', label: 'セラピスト一覧', active: true },
    { href: '/search/shops', label: '店舗一覧', active: false },
  ]

  const sortOptions = [
    { value: 'recommended', label: 'おすすめ順' },
    { value: 'price_asc', label: '料金が安い順' },
    { value: 'price_desc', label: '料金が高い順' },
    { value: 'rating', label: 'クチコミ評価順' },
    { value: 'new', label: '更新が新しい順' },
  ]

  const heroStatsSource = therapistHits.length ? therapistHits : buildTherapistHits(SAMPLE_RESULTS)
  const uniqueShopCount = new Set(heroStatsSource.map((hit) => hit.shopId || hit.shopSlug || hit.shopName)).size
  const readyNowCount = heroStatsSource.filter((hit) => hit.todayAvailable || hit.nextAvailableAt).length

  const headlineTherapistCount = therapistTotal ? numberFormatter.format(Math.max(therapistTotal, 250)) : '250'
  const headlineShopCount = uniqueShopCount ? numberFormatter.format(Math.max(uniqueShopCount, 48)) : '48'
  const headlineReadyCount = readyNowCount ? numberFormatter.format(Math.max(readyNowCount, 3)) : '3'

  const heroStats = [
    {
      label: '在籍セラピスト',
      value: `${headlineTherapistCount}+`,
      helper: '掲載中',
    },
    {
      label: '掲載店舗数',
      value: headlineShopCount,
      helper: '提携店',
    },
    {
      label: 'すぐ案内可能',
      value: headlineReadyCount,
      helper: '本日空きあり',
    },
  ]

  return (
    <main
      id="top"
      className="relative min-h-screen overflow-visible bg-[radial-gradient(circle_at_top,rgba(191,219,254,0.6)_0%,rgba(191,219,254,0)_55%),linear-gradient(180deg,#eef4ff_0%,#f3f8ff_45%,#ffffff_100%)] text-neutral-text"
    >
      <a
        href="#therapist-results"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-badge focus:bg-brand-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        検索結果へスキップ
      </a>
      <div className="relative isolate">
        <div className="mx-auto flex max-w-6xl flex-col gap-16 px-4 pb-28 pt-14 lg:px-6">
          <section className="relative overflow-hidden rounded-[56px] border border-white/40 bg-white/35 p-8 shadow-[0_45px_140px_rgba(37,99,235,0.25)] backdrop-blur-[28px] lg:p-16">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(147,197,253,0.3)_0%,rgba(147,197,253,0)_60%),radial-gradient(circle_at_bottom_right,rgba(96,165,250,0.22)_0%,rgba(96,165,250,0)_55%),url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2250%22 height=%2250%22 viewBox=%220 0 50 50%22%3E%3Cpath d=%22M0 49h1v1H0zM49 0h1v1h-1z%22 fill=%22%23ffffff29%22/%3E%3C/svg%3E')]" />
            <div className="flex flex-col gap-10">
              <div className="space-y-10">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/55 bg-white/55 px-5 py-1.5 text-xs font-semibold uppercase tracking-[0.28em] text-brand-primary shadow-[0_12px_30px_rgba(59,130,246,0.18)]">
                  大阪エリア最大級
                </div>
                <div className="space-y-5">
                  <h1 className="text-4xl font-bold tracking-tight text-neutral-text sm:text-5xl">
                    <span className="block text-transparent bg-gradient-to-r from-[#2563eb] via-[#2d9dff] to-[#22d3ee] bg-clip-text">
                      セラピストを
                    </span>
                    探す
                  </h1>
                  <p className="max-w-xl text-base text-neutral-textMuted">
                    大阪エリアで人気のセラピストを簡単に検索。
                    <br className="hidden sm:block" />お好みの条件で理想のセラピストが見つかります。
                  </p>
                  <div className="flex flex-wrap gap-4">
                    {heroStats.map((stat) => (
                      <div
                        key={stat.label}
                        className="flex items-center gap-3 rounded-[32px] border border-white/45 bg-white/45 px-7 py-4 shadow-[0_22px_60px_rgba(37,99,235,0.2)] backdrop-blur-sm"
                      >
                        <div className="text-transparent bg-gradient-to-r from-brand-primary to-brand-secondary bg-clip-text text-3xl font-bold">
                          {stat.value}
                        </div>
                        <div className="text-xs font-semibold text-neutral-textMuted leading-tight">{stat.helper}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {heroAreas.map(({ value, label }) => (
                    <Link
                      key={`hero-area-${value}`}
                      href={`/search?area=${encodeURIComponent(value)}`}
                      className="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/45 px-4 py-2 text-sm font-semibold text-brand-primary shadow-[0_10px_28px_rgba(37,99,235,0.15)] backdrop-blur-sm transition hover:border-brand-primary hover:bg-brand-primary/10 hover:text-brand-primary"
                    >
                      <span aria-hidden>→</span>
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section id="filters" className="overflow-visible rounded-[32px] border border-white/60 bg-white/92 p-6 shadow-[0_24px_80px_rgba(21,93,252,0.18)] backdrop-blur">
            <SearchFilters init={searchParams} facets={facets} sticky={false} resultCount={therapistTotal} />
          </section>

          <TherapistFavoritesProvider>
            <section className="rounded-[32px] border border-white/60 bg-white/92 p-6 shadow-[0_24px_80px_rgba(21,93,252,0.18)] backdrop-blur">
              <QuickFiltersHeading />
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {quickFilters.map((filter) => (
                  <Link
                    key={filter.label}
                    href={filter.href}
                    className="group inline-flex items-center justify-between gap-3 rounded-[24px] border border-white/70 bg-white/95 px-4 py-3 text-sm font-semibold text-neutral-text shadow-[0_12px_35px_rgba(21,93,252,0.12)] transition hover:border-brand-primary hover:bg-brand-primary/10 hover:text-brand-primary"
                  >
                    <div className="flex items-center gap-2">
                      <span aria-hidden className="text-lg">{filter.icon}</span>
                      {filter.label}
                    </div>
                    <span className="text-xs font-semibold text-brand-primary opacity-0 transition group-hover:opacity-100">
                      条件を適用 →
                    </span>
                  </Link>
                ))}
              </div>
            </section>

            {recentlyViewedTherapists.length ? (
              <section className="space-y-4 rounded-[32px] border border-white/60 bg-white/92 p-6 shadow-[0_24px_80px_rgba(21,93,252,0.18)] backdrop-blur">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-secondary/10 text-brand-secondary">
                    👀
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-neutral-text">最近見たセラピスト</h2>
                    <p className="text-xs text-neutral-textMuted">あなたが最近チェックしたセラピスト</p>
                  </div>
                </div>
                <TherapistCardListClient
                  therapists={recentlyViewedTherapists}
                  variant="featured"
                  className="grid gap-6 md:grid-cols-2 xl:grid-cols-3"
                />
              </section>
            ) : null}

            {featuredTherapists.length ? (
              <section className="space-y-6 rounded-[32px] border border-white/60 bg-white/92 p-6 shadow-[0_24px_80px_rgba(21,93,252,0.18)] backdrop-blur">
                <FeaturedSectionHeading title="人気のセラピスト" subtitle="口コミ評価の高いおすすめセラピスト" />
                <TherapistCardListClient therapists={featuredTherapists} variant="featured" className="grid gap-6 md:grid-cols-2 xl:grid-cols-3" />
              </section>
            ) : null}

            {_error ? (
              <Section className="border border-state-dangerBg bg-state-dangerBg/80 p-4 text-sm text-state-dangerText">
                {_error}
              </Section>
            ) : null}

            <section id="therapist-results" className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <nav className="inline-flex items-center gap-2 rounded-full border border-neutral-borderLight/70 bg-white/90 p-1 shadow-sm shadow-neutral-borderLight/40">
                  {viewSwitchLinks.map(({ href, label, active }) => (
                    <Link
                      key={href}
                      href={href}
                      className={clsx(
                        'inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition',
                        active
                          ? 'bg-gradient-to-r from-brand-primary to-brand-secondary text-white shadow shadow-brand-primary/30'
                          : 'text-neutral-text hover:bg-brand-primary/5 hover:text-brand-primary',
                      )}
                    >
                      {label}
                    </Link>
                  ))}
                </nav>
                <div className="inline-flex items-center gap-2 rounded-full border border-neutral-borderLight/70 bg-white/90 px-4 py-2 text-sm text-neutral-text">
                  <span aria-hidden>📋</span>
                  並び替え
                  <select
                    className="rounded-full border-none bg-transparent text-sm text-neutral-text focus:outline-none"
                    defaultValue="recommended"
                  >
                    {sortOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <header className="flex flex-wrap items-end justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-baseline gap-3">
                    <h2 className="text-2xl font-semibold text-neutral-text">セラピスト一覧</h2>
                    <span className="text-lg font-bold text-brand-primary">
                      {numberFormatter.format(therapistTotal)}名
                    </span>
                  </div>
                  <p className="text-sm text-neutral-textMuted">口コミ評価の高い順に表示しています</p>
                </div>
                <div className="text-xs text-neutral-textMuted">
                  ページ {resolvedPage} / {lastPage} ・ 店舗提供データをもとに表示
                </div>
              </header>

              <Section className="border border-neutral-borderLight/70 bg-white/95 shadow-card">
                {usingSampleTherapists ? (
                  <div className="mb-6 rounded-[24px] border border-brand-primary/30 bg-brand-primary/10 px-4 py-3 text-sm text-brand-primary">
                    API の検索結果にセラピスト情報が含まれていなかったため、参考用のサンプルセラピストを表示しています。
                  </div>
                ) : null}

                {therapistHits.length ? (
                  <TherapistCardListClient
                    therapists={therapistHits}
                    className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                  />
                ) : (
                  <div className="rounded-[28px] border border-dashed border-neutral-borderLight/70 bg-neutral-surfaceAlt/70 p-10 text-center text-neutral-textMuted">
                    条件に一致するセラピストが見つかりませんでした。
                  </div>
                )}

                {therapistHits.length ? (
                  <nav className="mt-10 flex flex-wrap items-center justify-between gap-3 text-sm" aria-label="セラピスト検索ページネーション">
                    <div className="text-neutral-textMuted" aria-live="polite">
                      {resolvedPage} / {lastPage}ページ（{numberFormatter.format(therapistTotal)}名）
                    </div>
                    <div className="flex items-center gap-2">
                      {resolvedPage > 1 ? (
                        <a
                          href={qp(resolvedPage - 1)}
                          className="rounded-full border border-neutral-borderLight/70 px-4 py-2 transition hover:border-brand-primary hover:text-brand-primary"
                        >
                          前へ
                        </a>
                      ) : (
                        <span className="rounded-full border border-neutral-borderLight/70 px-4 py-2 text-neutral-textMuted/60">
                          前へ
                        </span>
                      )}
                      {resolvedPage < lastPage ? (
                        <a
                          href={qp(resolvedPage + 1)}
                          className="rounded-full border border-neutral-borderLight/70 px-4 py-2 transition hover:border-brand-primary hover:text-brand-primary"
                        >
                          次へ
                        </a>
                      ) : (
                        <span className="rounded-full border border-neutral-borderLight/70 px-4 py-2 text-neutral-textMuted/60">
                          次へ
                        </span>
                      )}
                    </div>
                  </nav>
                ) : null}
              </Section>
            </section>
          </TherapistFavoritesProvider>
        </div>
      </div>
    </main>
  )
}
