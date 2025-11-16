"use client"

import type { TherapistHit } from '@/components/staff/TherapistCard'

type LeaderboardProps = {
  therapists: TherapistHit[]
}

export function Leaderboard({ therapists }: LeaderboardProps) {
  if (!therapists.length) return null

  return (
    <div className="rounded-[28px] border border-white/50 bg-white/80/80 px-5 py-4 shadow-glass backdrop-blur-sm">
      <div className="mb-3 text-sm font-semibold text-neutral-text">人気・ランキング</div>
      <ol className="space-y-2 text-sm text-neutral-text">
        {therapists.slice(0, 5).map((therapist, index) => (
          <li key={therapist.id || index} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-neutral-textMuted">#{index + 1}</span>
              <span className="font-medium">{therapist.name || therapist.alias || 'セラピスト'}</span>
            </div>
            <span className="text-xs text-neutral-textMuted">{therapist.rating?.toFixed(1) ?? '4.8'} ★</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
