import Link from 'next/link'
import type { CSSProperties } from 'react'

import SearchFilters from '@/components/SearchFilters'
import ShopCard, { type ShopHit } from '@/components/shop/ShopCard'
import { ShopFavoritesProvider } from '@/components/shop/ShopFavoritesProvider'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Section } from '@/components/ui/Section'

import {
  SAMPLE_RESULTS,
  applyClientFilters,
  buildEditorialSpots,
  buildSampleFacets,
  buildSampleResponse,
  fetchSearchResults,
  parseBoolParam,
  type FacetValue,
  type Params,
  type SpotlightItem,
} from '../shared'

const numberFormatter = new Intl.NumberFormat('ja-JP')

export default async function ShopSearchPage({ searchParams }: { searchParams: Promise<Params> }) {
  const resolvedSearchParams = await searchParams
  const forceSampleMode = parseBoolParam(
    Array.isArray(resolvedSearchParams.force_samples)
      ? resolvedSearchParams.force_samples[0]
      : resolvedSearchParams.force_samples,
  )

  const data = forceSampleMode
    ? buildSampleResponse(resolvedSearchParams)
    : await fetchSearchResults(resolvedSearchParams)
  const { results, facets, _error, page, page_size: pageSize, total } = data
  const hits = results ?? []
  const hasHits = hits.length > 0

  const sampleFallbackAllowed = !hasHits
  const displayHits = hasHits ? hits : applyClientFilters(resolvedSearchParams, SAMPLE_RESULTS)
  const shopTotal = hasHits ? total : displayHits.length
  const resolvedPageSize = hasHits ? pageSize || 12 : displayHits.length || 12
  const resolvedPage = hasHits ? page || 1 : 1
  const lastPage = hasHits ? Math.max(1, Math.ceil((total || 0) / resolvedPageSize)) : 1
  const editorialSpots = buildEditorialSpots(shopTotal)

  const areaFacetSource = facets.area ?? []
  const derivedAreaFacets: FacetValue[] = areaFacetSource.length
    ? areaFacetSource
    : Object.entries(
        (displayHits.length ? displayHits : SAMPLE_RESULTS).reduce<Record<string, number>>(
          (acc, hit) => {
            const key = hit.area_name || hit.area
            if (!key) return acc
            acc[key] = (acc[key] ?? 0) + 1
            return acc
          },
          {},
        ),
      ).map(([value, count]) => ({ value, label: value, count }))

  const pageTheme = {
    '--color-brand-primary': '#0f9bb4',
    '--color-brand-primary-dark': '#0b7087',
    '--color-brand-secondary': '#2563eb',
    '--color-surface': '#ffffff',
    '--color-surface-alt': '#f1f5f9',
    '--color-border-light': '#d3dbe8',
  } as CSSProperties

  const globalNavLinks = [
    { href: '/search', label: 'セラピスト検索' },
    { href: '/search/shops', label: '店舗検索' },
    { href: '/search/shops?today=true', label: '本日予約可' },
    { href: '/search/shops?promotions_only=true', label: 'キャンペーン中' },
    { href: '/search/shops?diaries_only=true', label: '写メ日記あり' },
  ]

  const areaLinks = derivedAreaFacets
    .filter((facet) => facet.count && facet.value)
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
    .slice(0, 8)
    .map((facet) => ({
      label: facet.label || facet.value,
      href: `/search/shops?area=${encodeURIComponent(facet.value)}`,
    }))

  const quickLinks = [...areaLinks, { label: 'セラピストで探す', href: '/search' }]

  const qp = (n: number) => {
    const entries = Object.entries(searchParams || {}).filter(
      ([, v]) => v !== undefined && v !== null,
    )
    const sp = new URLSearchParams(entries as [string, string][])
    sp.set('page', String(Math.min(Math.max(n, 1), lastPage)))
    return `/search/shops?${sp.toString()}`
  }

  return (
    <main
      id="top"
      style={pageTheme}
      className="relative min-h-screen overflow-hidden bg-[var(--color-surface-alt)] text-neutral-text"
    >
      <a
        href="#shop-results"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-badge focus:bg-brand-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        検索結果へスキップ
      </a>
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,148,173,0.18),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(79,70,229,0.12),_transparent_55%)]"
        aria-hidden
      />
      <div className="relative isolate">
        <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-10 lg:px-6">
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-brand-primary">
            {globalNavLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex items-center gap-1 rounded-full border border-brand-primary/20 bg-brand-primary/5 px-3 py-1 transition hover:border-brand-primary/60 hover:bg-brand-primary/10"
              >
                <span aria-hidden>🏬</span>
                {link.label}
              </Link>
            ))}
          </div>

          <div className="mt-6 rounded-[28px] border border-white/60 bg-white/90 p-6 shadow-xl shadow-brand-primary/10 backdrop-blur supports-[backdrop-filter]:bg-white/80 sm:p-10">
            <div className="grid gap-8 lg:grid-cols-[3fr_2fr] xl:grid-cols-[2fr_1fr]">
              <div className="space-y-5">
                <span className="inline-flex items-center gap-2 rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-primary">
                  <span aria-hidden>🏙</span>
                  店舗検索
                </span>
                <h1 className="text-3xl font-bold tracking-tight text-neutral-text sm:text-4xl">
                  大阪メンエス.com
                </h1>
                <p className="text-sm leading-relaxed text-neutral-textMuted sm:text-base">
                  エリア・料金・キャンペーン情報から大阪のメンズエステ店舗を比較できます。WEB予約リンクからリクエストすると担当者が折り返しご連絡します。
                </p>
                <div className="flex flex-wrap gap-2">
                  {quickLinks.map((link) => (
                    <Link
                      key={`hero-${link.href}`}
                      href={link.href}
                      className="inline-flex items-center gap-2 rounded-full border border-brand-primary/20 bg-brand-primary/5 px-4 py-2 text-sm font-semibold text-brand-primary transition hover:border-brand-primary/50 hover:bg-brand-primary/10"
                    >
                      <span aria-hidden>→</span>
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-brand-primary/15 bg-brand-primary/5 px-4 py-4 text-sm text-brand-primaryDark">
                  <div className="text-xs font-semibold uppercase tracking-wide text-brand-primary/70">
                    掲載店舗数
                  </div>
                  <div className="mt-2 text-2xl font-bold text-brand-primaryDark">
                    {numberFormatter.format(shopTotal)}
                    <span className="ml-1 text-sm font-medium text-brand-primary/70">件</span>
                  </div>
                </div>
                <div className="rounded-2xl border border-neutral-borderLight/70 bg-neutral-surface px-4 py-4 text-sm text-neutral-textMuted">
                  最新の出勤枠は各店舗ページの「出勤・空き状況」からご確認ください。
                </div>
              </div>
            </div>
          </div>

          {_error ? (
            <Card className="mt-8 border border-state-dangerBg bg-state-dangerBg/70 p-4 text-sm text-state-dangerText">
              {_error}
            </Card>
          ) : null}

          <div className="mt-8 space-y-6 lg:space-y-8" id="search-filters">
            <SearchFilters init={resolvedSearchParams} facets={facets} />

            <ShopFavoritesProvider>
              <Section
                id="shop-results"
                ariaLive="polite"
                title={`店舗検索結果 ${numberFormatter.format(shopTotal)}件`}
                subtitle={`ページ ${resolvedPage} / ${lastPage}（${resolvedPageSize}件ずつ表示）`}
                actions={<span className="text-xs text-neutral-textMuted">最新情報は毎日更新</span>}
                className="border border-neutral-borderLight/70 bg-white/85 shadow-lg shadow-neutral-950/5 backdrop-blur supports-[backdrop-filter]:bg-white/70"
              >
                {!hasHits ? (
                  <div className="mb-6 rounded-card border border-brand-primary/30 bg-brand-primary/5 p-4 text-sm text-brand-primaryDark">
                    API から検索結果を取得できなかったため、参考用のサンプル店舗を表示しています。
                  </div>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {displayHits.length ? (
                    (() => {
                      type GridItem =
                        | { kind: 'shop'; value: ShopHit }
                        | { kind: 'spotlight'; value: SpotlightItem }

                      const gridItems: GridItem[] = []
                      const prSlots = [1, 8, 15]

                      if (displayHits.length > 0) {
                        let prIndex = 0
                        displayHits.forEach((hit, idx) => {
                          if (prSlots.includes(idx + 1) && prIndex < editorialSpots.length) {
                            gridItems.push({ kind: 'spotlight', value: editorialSpots[prIndex] })
                            prIndex += 1
                          }
                          gridItems.push({ kind: 'shop', value: hit })
                        })
                        while (
                          gridItems.length < displayHits.length + editorialSpots.length &&
                          prIndex < editorialSpots.length
                        ) {
                          gridItems.push({ kind: 'spotlight', value: editorialSpots[prIndex] })
                          prIndex += 1
                        }
                      }

                      const itemsToRender = gridItems.length
                        ? gridItems
                        : displayHits.map((hit) => ({ kind: 'shop', value: hit }))

                      return itemsToRender.map((item) =>
                        item.kind === 'shop' ? (
                          <ShopCard key={item.value.id} hit={item.value} />
                        ) : (
                          <a
                            key={item.value.id}
                            href={item.value.href}
                            className="block focus:outline-none"
                          >
                            <Card
                              interactive
                              className="h-full bg-gradient-to-br from-brand-primary/15 via-brand-primary/10 to-brand-secondary/15 p-6"
                            >
                              <Badge variant="brand" className="mb-3 w-fit shadow-sm">
                                PR
                              </Badge>
                              <h3 className="text-lg font-semibold text-neutral-text">
                                {item.value.title}
                              </h3>
                              <p className="mt-2 text-sm text-neutral-textMuted">
                                {item.value.description}
                              </p>
                              <span className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-brand-primaryDark">
                                くわしく見る
                                <span aria-hidden>→</span>
                              </span>
                            </Card>
                          </a>
                        ),
                      )
                    })()
                  ) : (
                    <div className="col-span-full rounded-card border border-dashed border-neutral-borderLight/80 bg-neutral-surfaceAlt/70 p-10 text-center text-neutral-textMuted">
                      条件に一致する店舗が見つかりませんでした。
                    </div>
                  )}
                </div>

                <nav
                  className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-borderLight/70 pt-5 text-sm"
                  aria-label="店舗検索ページネーション"
                >
                  <div className="text-neutral-textMuted" aria-live="polite">
                    {resolvedPage} / {lastPage}ページ（{numberFormatter.format(shopTotal)}件）
                  </div>
                  <div className="flex items-center gap-2">
                    {resolvedPage > 1 ? (
                      <a
                        href={qp(resolvedPage - 1)}
                        className="rounded-badge border border-neutral-borderLight px-3 py-1 transition hover:border-brand-primary hover:text-brand-primary"
                      >
                        前へ
                      </a>
                    ) : (
                      <span className="rounded-badge border border-neutral-borderLight/70 px-3 py-1 text-neutral-textMuted/60">
                        前へ
                      </span>
                    )}
                    {resolvedPage < lastPage ? (
                      <a
                        href={qp(resolvedPage + 1)}
                        className="rounded-badge border border-neutral-borderLight px-3 py-1 transition hover:border-brand-primary hover:text-brand-primary"
                      >
                        次へ
                      </a>
                    ) : (
                      <span className="rounded-badge border border-neutral-borderLight/70 px-3 py-1 text-neutral-textMuted/60">
                        次へ
                      </span>
                    )}
                  </div>
                </nav>
              </Section>
            </ShopFavoritesProvider>
          </div>
        </div>

        <a
          href="#top"
          aria-label="ページ上部へ戻る"
          className="fixed bottom-6 right-4 hidden h-12 w-12 items-center justify-center rounded-full bg-brand-primary text-lg font-semibold text-white shadow-lg shadow-brand-primary/40 transition hover:bg-brand-primaryDark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary lg:inline-flex"
        >
          ↑
        </a>
      </div>
    </main>
  )
}
