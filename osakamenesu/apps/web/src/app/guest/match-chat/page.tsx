"use client"

import { useMemo, useState } from 'react'

import Link from 'next/link'

import { Card } from '@/components/ui/Card'
import { Section } from '@/components/ui/Section'

type MatchingCandidate = {
  therapist_id: string
  therapist_name: string
  shop_id: string
  shop_name: string
  score: number
  summary?: string | null
  slots?: { start_at: string; end_at: string }[]
}

type MatchingResponse = {
  top_matches: MatchingCandidate[]
  other_candidates: MatchingCandidate[]
}

const budgetOptions = [
  { id: 'low', label: '〜15,000円' },
  { id: 'mid', label: '15,000〜20,000円' },
  { id: 'high', label: '20,000円以上' },
]

const moodOptions = [
  { id: 'relax', label: 'とにかく癒やされたい', mood: { calm: 1 }, style: { relax: 1 } },
  { id: 'talk', label: 'おしゃべりして発散したい', mood: { friendly: 1 }, talk: { talkative: 1 } },
  { id: 'strong', label: 'しっかりめにほぐしてほしい', mood: { energetic: 0.8 }, style: { strong: 1 } },
  { id: 'unknown', label: 'お任せしたい', mood: {}, style: {} },
]

function buildPrefFromMood(selection: string | null) {
  const chosen = moodOptions.find((m) => m.id === selection)
  if (!chosen) return {}
  return {
    mood_pref: chosen.mood ?? {},
    talk_pref: chosen.talk ?? {},
    style_pref: chosen.style ?? {},
  }
}

export default function MatchChatPage() {
  const [area, setArea] = useState('大阪市内')
  const [date, setDate] = useState('')
  const [budget, setBudget] = useState<string | null>(null)
  const [mood, setMood] = useState<string | null>(null)
  const [freeText, setFreeText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<MatchingResponse | null>(null)

  const payload = useMemo(() => {
    const pref = buildPrefFromMood(mood)
    return {
      area,
      date,
      budget_level: budget,
      free_text: freeText || undefined,
      ...pref,
    }
  }, [area, date, budget, mood, freeText])

  const handleSubmit = async () => {
    if (!area || !date) {
      setError('エリアと日付を入力してください。')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const resp = await fetch('/api/guest/matching/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!resp.ok) {
        throw new Error(`Request failed (${resp.status})`)
      }
      const data = (await resp.json()) as MatchingResponse
      setResult(data)
    } catch (err) {
      setError('おすすめ取得に失敗しました。時間をおいて再度お試しください。')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
      <Section
        title="コンシェルジュに相談して探す"
        subtitle="2〜3問の簡単な質問に答えるだけで、今日の空き状況や相性の良さをふまえたおすすめをお出しします。"
        className="border border-neutral-borderLight/70 bg-white shadow-lg shadow-neutral-950/5"
      >
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-4 text-sm">
            <div className="mb-2 font-semibold text-neutral-text">Step 1</div>
            <p className="text-neutral-textMuted">エリア・日付・予算を選ぶ</p>
          </Card>
          <Card className="p-4 text-sm">
            <div className="mb-2 font-semibold text-neutral-text">Step 2</div>
            <p className="text-neutral-textMuted">今日の気分をチップから選ぶ</p>
          </Card>
          <Card className="p-4 text-sm">
            <div className="mb-2 font-semibold text-neutral-text">Step 3</div>
            <p className="text-neutral-textMuted">
              任意で好みの雰囲気を入力すると、マッチング精度が上がります
            </p>
          </Card>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card className="space-y-4 p-4 text-sm">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-neutral-text">エリア</label>
              <input
                className="w-full rounded border border-neutral-borderLight px-3 py-2 text-sm"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="例）大阪市内 / 梅田 / 心斎橋"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-neutral-text">日付</label>
              <input
                type="date"
                className="w-full rounded border border-neutral-borderLight px-3 py-2 text-sm"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-neutral-text">予算</label>
              <div className="flex flex-wrap gap-2">
                {budgetOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setBudget(opt.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      budget === opt.id
                        ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                        : 'border-neutral-borderLight text-neutral-text'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          <Card className="space-y-4 p-4 text-sm">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-neutral-text">今日の気分</label>
              <div className="grid gap-2 sm:grid-cols-2">
                {moodOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setMood(opt.id)}
                    className={`rounded-lg border p-3 text-left transition ${
                      mood === opt.id
                        ? 'border-brand-secondary bg-brand-secondary/10 text-brand-secondaryDark'
                        : 'border-neutral-borderLight text-neutral-text'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-neutral-text">
                好みの雰囲気（任意）
              </label>
              <textarea
                className="h-20 w-full rounded border border-neutral-borderLight px-3 py-2 text-sm"
                placeholder="例）静かめでおっとり / お姉さん系 / おしゃべり好き など"
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
              />
            </div>
          </Card>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary px-5 py-2 font-semibold text-white shadow transition hover:from-brand-primary/90 hover:to-brand-secondary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'おすすめを探しています...' : 'この条件でおすすめをみる'}
          </button>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 rounded-full border border-neutral-borderLight px-4 py-2 font-semibold text-neutral-text transition hover:border-brand-primary hover:text-brand-primary"
          >
            条件検索に戻る
          </Link>
          <span className="text-neutral-textMuted">
            ※ 本機能は順次アップデート予定です。より多くの候補提示や自動タグ生成を準備中です。
          </span>
        </div>

        {error ? (
          <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {result ? (
          <div className="mt-6 space-y-4">
            <h3 className="text-lg font-semibold text-neutral-text">おすすめ候補</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {result.top_matches.map((m) => (
                <Card key={m.therapist_id} className="space-y-3 p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-base font-semibold text-neutral-text">{m.therapist_name}</div>
                      <div className="text-xs text-neutral-textMuted">{m.shop_name}</div>
                    </div>
                    <div className="text-xs font-semibold text-brand-primary">あなたの条件に近い順</div>
                  </div>
                  {m.summary ? <p className="text-neutral-textMuted">{m.summary}</p> : null}
                  {m.slots && m.slots.length ? (
                    <div className="flex flex-wrap gap-2">
                      {m.slots.slice(0, 3).map((slot, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="rounded-badge border border-brand-primary/30 bg-brand-primary/10 px-3 py-1 text-xs font-semibold text-brand-primary"
                        >
                          {slot.start_at.replace('T', ' ').slice(5, 16)}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-neutral-textMuted">空き枠情報は後でご案内します</div>
                  )}
                </Card>
              ))}
            </div>

            {result.other_candidates.length ? (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-neutral-text">その他の候補</h4>
                <ul className="space-y-1 text-sm text-neutral-textMuted">
                  {result.other_candidates.map((m) => (
                    <li key={m.therapist_id}>
                      {m.therapist_name}（{m.shop_name}） - スコア {m.score.toFixed(2)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </Section>
    </main>
  )
}
