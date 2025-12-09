"use client"

import { useEffect, useMemo, useState } from 'react'

import Image from 'next/image'
import Link from 'next/link'

import { rerankMatchingCandidates } from '@/features/matching/recommendedRanking'
import { NextAvailableSlotBadge } from '@/components/availability/NextAvailableSlotBadge'
import { getNextAvailableSlot } from '@/lib/schedule'

type MatchingCandidate = {
  therapist_id: string
  therapist_name: string
  shop_id: string
  shop_name: string
  score: number
  summary?: string | null
  avatar_url?: string | null
  slots?: { start_at: string; end_at: string; status?: string }[]
}

type MatchingResponse = {
  top_matches: MatchingCandidate[]
  other_candidates: MatchingCandidate[]
}

type Phase = 'explore' | 'narrow' | 'book'

const budgetOptions = [
  { id: 'low', label: '〜15,000円' },
  { id: 'mid', label: '15,000〜20,000円' },
  { id: 'high', label: '20,000円以上' },
]

const moodOptions = [
  { id: 'relax', label: 'とにかく癒やされたい', icon: '🌸', mood: { calm: 1 }, style: { relax: 1 } },
  { id: 'talk', label: 'おしゃべりして発散したい', icon: '💬', mood: { friendly: 1 }, talk: { talkative: 1 } },
  { id: 'strong', label: 'しっかりめにほぐしてほしい', icon: '💪', mood: { energetic: 0.8 }, style: { strong: 1 } },
  { id: 'unknown', label: 'お任せしたい', icon: '✨', mood: {}, style: {} },
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

// Step indicator icons
function StepIcon({ step, isActive, isCompleted }: { step: number; isActive: boolean; isCompleted: boolean }) {
  const icons = [
    // Step 1: Location/Calendar
    <svg key="1" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>,
    // Step 2: Mood/Heart
    <svg key="2" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>,
    // Step 3: Sparkle/Magic
    <svg key="3" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>,
  ]

  return (
    <div className={`flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300 ${
      isCompleted
        ? 'bg-gradient-to-br from-emerald-400 to-emerald-500 text-white shadow-lg shadow-emerald-500/30'
        : isActive
        ? 'bg-gradient-to-br from-brand-primary to-brand-secondary text-white shadow-lg shadow-brand-primary/30 animate-pulse'
        : 'bg-white/80 text-neutral-400 border border-neutral-200'
    }`}>
      {isCompleted ? (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        icons[step - 1]
      )}
    </div>
  )
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
  const [phase, setPhase] = useState<Phase>('explore')

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

  const [stepIndex, setStepIndex] = useState(1)

  // Calculate current step based on filled data
  const currentStep = useMemo(() => {
    if (mood) return 3
    if (area && date) return 2
    return 1
  }, [area, date, mood])

  // 会話をやり直した場合（エリア/日付を変更したとき）はステップをリセットする
  useEffect(() => {
    setStepIndex(1)
  }, [area, date])

  const buildQuery = (phaseValue: Phase) => {
    const params = new URLSearchParams()
    params.set('area', area)
    if (date) params.set('date', date)
    params.set('sort', 'recommended')
    params.set('entry_source', 'concierge')
    params.set('phase', phaseValue)
    params.set('step_index', String(stepIndex))
    if (budget) params.set('budget_level', budget)
    if (freeText) params.set('free_text', freeText)
    return params
  }

  const handleSubmit = async () => {
    if (!area || !date) {
      setError('エリアと日付を入力してください。')
      return
    }
    const nextPhase: Phase = date ? 'book' : mood || budget ? 'narrow' : 'explore'
    setPhase(nextPhase)
    setStepIndex((prev) => prev + 1)
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const params = buildQuery(nextPhase)

      const resp = await fetch(`/api/guest/matching/search?${params.toString()}`, {
        method: 'GET',
      })
      if (!resp.ok) {
        console.error('match-chat search failed', resp.status)
        setError('おすすめ取得に失敗しました。時間をおいて再度お試しください。')
        return
      }
      const data = await resp.json()
      const items = Array.isArray(data.items) ? data.items : []
      const reranked = rerankMatchingCandidates(
        { area, date, time_from: undefined, time_to: undefined },
        items,
      )

      const rankedItems: MatchingCandidate[] = reranked.map((m: any) => ({
        therapist_id: m.therapist_id || m.id || '',
        therapist_name: m.therapist_name || m.name || '',
        shop_id: m.shop_id || '',
        shop_name: m.shop_name || '',
        score: m.recommended_score ?? m.score ?? 0,
        summary: m.summary,
        avatar_url: m.avatar_url || m.photo_url || null,
        slots: m.slots || [],
      }))

      setResult({
        top_matches: rankedItems.slice(0, 3),
        other_candidates: rankedItems.slice(3),
      })
    } catch (err) {
      setError('おすすめ取得に失敗しました。時間をおいて再度お試しください。')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-brand-primary via-brand-primary to-brand-secondary py-12 sm:py-16">
        {/* Decorative elements */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-4xl px-4 text-center">
          {/* AI Badge */}
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/20 px-4 py-1.5 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            <span className="text-xs font-semibold text-white">本能AIマッチング</span>
          </div>

          <h1 className="text-2xl font-bold text-white sm:text-3xl lg:text-4xl">
            コンシェルジュに相談して探す
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/80 sm:text-base">
            {phase === 'explore'
              ? 'まずは好みを教えてください（元気/おっとり/お姉さん系など）。'
              : phase === 'narrow'
              ? '候補が絞れてきました。いつ頃行けそうか教えてください。'
              : 'この子で予約しましょう。具体的な日付が決まったら予約候補を出します。'}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Progress Steps */}
        <div className="relative mb-8">
          <div className="absolute left-0 right-0 top-5 h-0.5 bg-neutral-200">
            <div
              className="h-full bg-gradient-to-r from-brand-primary to-brand-secondary transition-all duration-500"
              style={{ width: `${((currentStep - 1) / 2) * 100}%` }}
            />
          </div>
          <div className="relative flex justify-between">
            {[
              { step: 1, title: 'Step 1', desc: 'エリア・日付・予算を選ぶ' },
              { step: 2, title: 'Step 2', desc: '今日の気分をチップから選ぶ' },
              { step: 3, title: 'Step 3', desc: '好みの雰囲気でマッチング精度UP' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex flex-col items-center">
                <StepIcon
                  step={step}
                  isActive={currentStep === step}
                  isCompleted={currentStep > step}
                />
                <div className="mt-2 text-center">
                  <div className={`text-xs font-bold ${currentStep >= step ? 'text-brand-primary' : 'text-neutral-400'}`}>
                    {title}
                  </div>
                  <div className="mt-0.5 hidden max-w-[120px] text-[10px] text-neutral-500 sm:block">
                    {desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Content Cards */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Card: Location & Date */}
          <div className="group relative overflow-hidden rounded-3xl border border-white/60 bg-white/80 p-6 shadow-[0_8px_32px_rgba(37,99,235,0.08)] backdrop-blur-sm transition-all duration-300 hover:shadow-[0_16px_48px_rgba(37,99,235,0.12)]">
            {/* Decorative gradient */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.06),transparent_50%)]" />

            {/* Header */}
            <div className="relative mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary text-white shadow-lg shadow-brand-primary/20">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-neutral-text">基本情報</h3>
                <p className="text-xs text-neutral-textMuted">エリア・日付・予算</p>
              </div>
            </div>

            <div className="relative space-y-5">
              {/* Area Input */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-neutral-text">
                  <svg className="h-3.5 w-3.5 text-brand-primary" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                  エリア
                </label>
                <input
                  className="w-full rounded-xl border border-neutral-200 bg-white/90 px-4 py-3 text-sm shadow-sm transition-all duration-200 placeholder:text-neutral-400 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="例）大阪市内 / 梅田 / 心斎橋"
                />
              </div>

              {/* Date Input */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-neutral-text">
                  <svg className="h-3.5 w-3.5 text-brand-primary" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  日付
                </label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-neutral-200 bg-white/90 px-4 py-3 text-sm shadow-sm transition-all duration-200 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              {/* Budget Options */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-neutral-text">
                  <svg className="h-3.5 w-3.5 text-brand-primary" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  予算
                </label>
                <div className="flex flex-wrap gap-2">
                  {budgetOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setBudget(budget === opt.id ? null : opt.id)}
                      className={`rounded-full border px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                        budget === opt.id
                          ? 'border-brand-primary bg-gradient-to-r from-brand-primary to-brand-secondary text-white shadow-md shadow-brand-primary/20'
                          : 'border-neutral-200 bg-white text-neutral-600 hover:border-brand-primary/50 hover:bg-brand-primary/5'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Card: Mood Selection */}
          <div className="group relative overflow-hidden rounded-3xl border border-white/60 bg-white/80 p-6 shadow-[0_8px_32px_rgba(147,51,234,0.08)] backdrop-blur-sm transition-all duration-300 hover:shadow-[0_16px_48px_rgba(147,51,234,0.12)]">
            {/* Decorative gradient */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(147,51,234,0.06),transparent_50%)]" />

            {/* Header */}
            <div className="relative mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/20">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-neutral-text">今日の気分</h3>
                <p className="text-xs text-neutral-textMuted">どんな時間を過ごしたいですか？</p>
              </div>
            </div>

            <div className="relative space-y-5">
              {/* Mood Options */}
              <div className="grid gap-2 sm:grid-cols-2">
                {moodOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setMood(mood === opt.id ? null : opt.id)}
                    className={`group/btn relative overflow-hidden rounded-xl border p-4 text-left transition-all duration-200 ${
                      mood === opt.id
                        ? 'border-purple-300 bg-gradient-to-br from-purple-50 to-pink-50 shadow-md'
                        : 'border-neutral-200 bg-white hover:border-purple-200 hover:bg-purple-50/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{opt.icon}</span>
                      <span className={`text-sm font-medium ${mood === opt.id ? 'text-purple-700' : 'text-neutral-700'}`}>
                        {opt.label}
                      </span>
                    </div>
                    {mood === opt.id && (
                      <div className="absolute right-2 top-2">
                        <svg className="h-4 w-4 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Free Text */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-neutral-text">
                  <svg className="h-3.5 w-3.5 text-purple-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  好みの雰囲気（任意）
                </label>
                <textarea
                  className="h-24 w-full resize-none rounded-xl border border-neutral-200 bg-white/90 px-4 py-3 text-sm shadow-sm transition-all duration-200 placeholder:text-neutral-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-400/20"
                  placeholder="例）静かめでおっとり / お姉さん系 / おしゃべり好き など"
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="group relative inline-flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-gradient-to-r from-brand-primary to-brand-secondary px-8 py-4 text-base font-bold text-white shadow-[0_12px_36px_rgba(37,99,235,0.35)] transition-all duration-300 hover:shadow-[0_16px_48px_rgba(37,99,235,0.45)] hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 sm:w-auto"
          >
            {/* Animated shine */}
            <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

            {loading ? (
              <>
                <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>おすすめを探しています...</span>
              </>
            ) : (
              <>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span>この条件でおすすめをみる</span>
                <svg className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </>
            )}
          </button>

          <Link
            href="/search"
            className="inline-flex items-center gap-2 rounded-2xl border-2 border-neutral-200 bg-white px-6 py-3.5 font-semibold text-neutral-600 transition-all duration-200 hover:border-brand-primary hover:text-brand-primary"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            条件検索に戻る
          </Link>
        </div>

        {/* Notice */}
        <p className="mt-4 text-center text-xs text-neutral-textMuted">
          ※ 本機能は順次アップデート予定です。より多くの候補提示や自動タグ生成を準備中です。
        </p>

        {/* Error Message */}
        {error ? (
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 to-red-50/50 px-5 py-4 text-sm font-medium text-red-600">
            <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {error}
          </div>
        ) : null}

        {/* Results Section */}
        {result ? (
          <div className="mt-10 space-y-6">
            {/* Results Header */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-500 text-white shadow-lg shadow-emerald-500/20">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-neutral-text">おすすめ候補</h3>
                <p className="text-xs text-neutral-textMuted">あなたの条件に最適なセラピストです</p>
              </div>
            </div>

            {/* Candidate Cards */}
            <div className="grid gap-4 md:grid-cols-2">
              {result.top_matches.map((m, index) => (
                <div
                  key={m.therapist_id}
                  className="group relative overflow-hidden rounded-2xl border border-white/60 bg-white/90 p-5 shadow-[0_8px_24px_rgba(0,0,0,0.06)] backdrop-blur-sm transition-all duration-300 hover:shadow-[0_16px_40px_rgba(37,99,235,0.15)] hover:border-brand-primary/30"
                >
                  {/* Rank Badge */}
                  <div className="absolute -right-8 -top-8 h-16 w-16 rotate-45 bg-gradient-to-br from-amber-400 to-orange-500">
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 rotate-[-45deg] text-xs font-bold text-white">
                      #{index + 1}
                    </span>
                  </div>

                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      {m.avatar_url ? (
                        <Image
                          src={m.avatar_url}
                          alt={m.therapist_name}
                          width={72}
                          height={72}
                          className="h-[72px] w-[72px] rounded-2xl object-cover shadow-md"
                        />
                      ) : (
                        <div className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-gradient-to-br from-brand-primary/20 to-brand-secondary/20 text-2xl font-bold text-brand-primary">
                          {m.therapist_name.charAt(0)}
                        </div>
                      )}
                      {/* Online indicator */}
                      <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white bg-emerald-400" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-base font-bold text-neutral-text">{m.therapist_name}</h4>
                        <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-[10px] font-bold text-brand-primary">
                          あなたの条件に近い順
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-neutral-textMuted">{m.shop_name}</p>
                      {m.summary ? (
                        <p className="mt-2 line-clamp-2 text-xs text-neutral-600">{m.summary}</p>
                      ) : null}
                    </div>
                  </div>

                  {/* Slots - 共通コンポーネントで統一表示 */}
                  {m.slots && m.slots.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {m.slots.slice(0, 3).map((slot, idx) => (
                        <NextAvailableSlotBadge
                          key={idx}
                          slot={{
                            start_at: slot.start_at,
                            end_at: slot.end_at,
                            status: slot.status || 'open',
                          }}
                          variant="inline"
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-xs text-neutral-textMuted">空き枠情報は後でご案内します</p>
                  )}

                  {/* Action Buttons */}
                  <div className="mt-4 flex gap-2">
                    <Link
                      className="flex-1 rounded-xl border border-neutral-200 bg-white py-2.5 text-center text-xs font-bold text-brand-primary transition-all duration-200 hover:border-brand-primary hover:bg-brand-primary/5"
                      href={`/guest/therapists/${m.therapist_id}?shop_id=${m.shop_id}&name=${encodeURIComponent(m.therapist_name)}&shop_name=${encodeURIComponent(m.shop_name)}`}
                    >
                      詳細を見る
                    </Link>
                    <Link
                      className="flex-1 rounded-xl bg-gradient-to-r from-brand-primary to-brand-secondary py-2.5 text-center text-xs font-bold text-white shadow-md shadow-brand-primary/20 transition-all duration-200 hover:shadow-lg hover:shadow-brand-primary/30"
                      href={`/guest/therapists/${m.therapist_id}/reserve?shop_id=${m.shop_id}${date ? `&date=${date}` : ''}`}
                    >
                      この子で予約する
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Other Candidates */}
            {result.other_candidates.length ? (
              <div className="rounded-2xl border border-neutral-200 bg-white/80 p-5">
                <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-neutral-text">
                  <svg className="h-4 w-4 text-neutral-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                  その他の候補
                </h4>
                <ul className="space-y-2 text-sm text-neutral-textMuted">
                  {result.other_candidates.map((m) => (
                    <li key={m.therapist_id} className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2">
                      <span>{m.therapist_name}（{m.shop_name}）</span>
                      <span className="text-xs text-neutral-400">スコア {m.score.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </main>
  )
}
