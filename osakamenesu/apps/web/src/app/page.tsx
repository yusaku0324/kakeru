import Link from 'next/link'

import ShopCard from '@/components/shop/ShopCard'
import TherapistCard from '@/components/staff/TherapistCard'
import { TherapistFavoritesProvider } from '@/components/staff/TherapistFavoritesProvider'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Section } from '@/components/ui/Section'
import { SearchAvailableToday } from './search/_components/SearchHeroSections'
import {
  buildSampleResponse,
  buildSampleFacets,
  buildTherapistHits,
  buildEditorialSpots,
} from './search/shared'

function buildHighlights(facets: Record<string, any[]>, hits: any[]) {
  const highlights: string[] = []
  const areas = [...(facets.area ?? [])].sort((a, b) => (b.count ?? 0) - (a.count ?? 0)).slice(0, 3)
  if (areas.length) {
    highlights.push(`人気エリア: ${areas.map((a) => a.label || a.value).join(' / ')}`)
  }

  const services = [...(facets.service_type ?? [])]
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
    .slice(0, 2)
  if (services.length) {
    highlights.push(`主な業態: ${services.map((s) => s.label || s.value).join('・')}`)
  }

  const priceBands = [...(facets.price_band ?? [])]
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
    .slice(0, 2)
  if (priceBands.length) {
    highlights.push(`人気料金帯: ${priceBands.map((p) => p.label || p.value).join(' / ')}`)
  }

  const todayCount = hits.filter((h) => h.today_available).length
  if (todayCount) {
    highlights.push(`本日予約可能: ${todayCount}件`)
  }

  const priced = hits.filter((h) => h.min_price || h.max_price)
  if (priced.length) {
    const minAvg = Math.round(
      priced.reduce((sum, h) => sum + (h.min_price || 0), 0) / priced.length,
    )
    const maxAvg = Math.round(
      priced.reduce((sum, h) => sum + (h.max_price || h.min_price || 0), 0) / priced.length,
    )
    if (minAvg) {
      const intl = new Intl.NumberFormat('ja-JP')
      highlights.push(
        `予算目安: ¥${intl.format(minAvg)}〜¥${intl.format(Math.max(minAvg, maxAvg))}`,
      )
    }
  }

  return highlights
}

export default function HomePage() {
  const response = buildSampleResponse()
  const hits = response.results
  const facets = buildSampleFacets(hits)
  const therapistHits = buildTherapistHits(hits).slice(0, 2)
  const displayHighlights = buildHighlights(facets, hits)
  const availableToday = hits.filter((hit) => hit.today_available).slice(0, 3)
  const displayEditorialSpots = buildEditorialSpots(hits.length)

  return (
    <main className="relative min-h-screen overflow-hidden bg-neutral-surface">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(147,197,253,0.18),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(196,181,253,0.16),_transparent_50%)]"
        aria-hidden
      />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 lg:px-6">
        <header className="relative overflow-hidden rounded-section border border-white/60 bg-white/75 px-6 py-8 shadow-xl shadow-brand-primary/5 backdrop-blur supports-[backdrop-filter]:bg-white/65">
          <div
            className="pointer-events-none absolute -top-10 right-0 h-32 w-32 rounded-full bg-brand-primary/10 blur-3xl"
            aria-hidden
          />
          <div className="space-y-6">
            <div className="space-y-3 text-neutral-text">
              <span className="inline-flex items-center gap-1 rounded-badge border border-brand-primary/20 bg-brand-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-primary/90">
                大阪メンエス.com
              </span>
              <h1 className="text-3xl font-semibold tracking-tight text-neutral-text">
                セラピストを探す
              </h1>
              <p className="max-w-3xl text-sm leading-relaxed text-neutral-textMuted">
                出勤予定や写メ日記、在籍スタッフの雰囲気まで、大阪のメンエス情報をここでまとめてチェックできます。エリアや得意な施術、今日の気分に合わせて、会いに行きたいセラピストを気軽に探してみてください。
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/search?tab=therapists&today=1"
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary px-6 py-2.5 text-sm font-semibold text-white shadow-[0_20px_45px_rgba(37,99,235,0.26)] transition hover:from-brand-primary/90 hover:to-brand-secondary/90"
                >
                  本日予約できるセラピストを見る
                </Link>
              </div>
            </div>
            {displayHighlights.length ? (
              <div className="flex flex-wrap items-center gap-2">
                {displayHighlights.map((item) => (
                  <Badge
                    key={item}
                    variant="outline"
                    className="border-brand-primary/30 bg-brand-primary/5 text-brand-primaryDark"
                  >
                    {item}
                  </Badge>
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 text-xs text-neutral-text">
              <Link
                href="/search?area=%E9%9B%A3%E6%B3%A2%2F%E6%97%A5%E6%9C%AC%E6%A9%8B"
                className="inline-flex items-center gap-1 rounded-badge border border-neutral-borderLight/70 bg-neutral-surfaceAlt px-3 py-1 font-semibold text-neutral-text transition hover:border-brand-primary hover:text-brand-primary"
              >
                <span aria-hidden>🔍</span>
                難波/日本橋 (1)
              </Link>
            </div>
          </div>
        </header>

        <SearchAvailableToday shops={availableToday} />

        <nav className="flex flex-wrap gap-3 text-sm font-semibold text-neutral-text">
          <Link
            href="/search"
            className="rounded-badge border border-neutral-borderLight px-4 py-1 transition hover:border-brand-primary hover:text-brand-primary"
          >
            総合で探す
          </Link>
          <Link
            href="/search?tab=therapists"
            className="rounded-badge border border-neutral-borderLight px-4 py-1 transition hover:border-brand-primary hover:text-brand-primary"
          >
            セラピスト一覧
          </Link>
          <Link
            href="/search?tab=shops"
            className="rounded-badge border border-neutral-borderLight px-4 py-1 transition hover:border-brand-primary hover:text-brand-primary"
          >
            店舗一覧
          </Link>
        </nav>

        <Section
          id="home-shop-pickup"
          title={`店舗（${hits.length}件）`}
          subtitle="編集部のピックアップ店舗"
          className="border border-neutral-borderLight/70 bg-white/85 shadow-lg shadow-neutral-950/5 backdrop-blur supports-[backdrop-filter]:bg-white/70"
        >
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {hits.slice(0, 3).map((hit) => (
              <ShopCard key={hit.id} hit={hit} />
            ))}
          </div>
        </Section>

        {therapistHits.length ? (
          <TherapistFavoritesProvider>
            <Section
              id="home-therapist-pickup"
              title={`セラピスト（${therapistHits.length}名）`}
              subtitle="人気のセラピストを一部ご紹介"
              className="border border-neutral-borderLight/70 bg-white/85 shadow-lg shadow-neutral-950/5 backdrop-blur supports-[backdrop-filter]:bg-white/70"
            >
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {therapistHits.map((hit) => (
                  <TherapistCard key={hit.id} hit={hit} />
                ))}
              </div>
            </Section>
          </TherapistFavoritesProvider>
        ) : null}

        {displayEditorialSpots.length ? (
          <Section
            title="掲載をご検討の店舗さまへ"
            subtitle="PR枠や季節キャンペーンのご案内"
            className="border border-neutral-borderLight/70 bg-white/90 shadow-lg shadow-neutral-950/5 backdrop-blur supports-[backdrop-filter]:bg-white/80"
          >
            <div className="grid gap-4 md:grid-cols-2">
              {displayEditorialSpots.map((item) => (
                <a key={item.id} href={item.href} className="block focus:outline-none">
                  <Card
                    interactive
                    className="h-full bg-gradient-to-br from-brand-primary/15 via-brand-primary/10 to-brand-secondary/15 p-6"
                  >
                    <Badge variant="brand" className="mb-3 w-fit shadow-sm">
                      SHOP PR
                    </Badge>
                    <h3 className="text-lg font-semibold text-neutral-text">{item.title}</h3>
                    <p className="mt-2 text-sm text-neutral-textMuted">{item.description}</p>
                    <span className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-brand-primaryDark">
                      くわしく見る
                      <span aria-hidden>→</span>
                    </span>
                  </Card>
                </a>
              ))}
            </div>
          </Section>
        ) : null}
      </div>
    </main>
  )
}
