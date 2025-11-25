'use client'

import { useCallback, useEffect, useState } from 'react'

type TherapistItem = {
  id: string
  name: string
  shop?: string | null
  headline?: string | null
}

type TherapistsResponse = { items?: TherapistItem[] }

export default function AdminTherapistsPage() {
  const [therapists, setTherapists] = useState<TherapistItem[]>([])
  const [loading, setLoading] = useState(true)

  const loadTherapists = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await fetch('/api/admin/therapists', { cache: 'no-store' })
      if (resp.ok) {
        const data = (await resp.json()) as TherapistsResponse
        setTherapists(data.items ?? [])
      } else {
        setTherapists([])
      }
    } catch (error) {
      console.error('Failed to load therapists', error)
      setTherapists([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTherapists()
  }, [loadTherapists])

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <div>
        <h1 data-testid="admin-title" className="text-2xl font-semibold">
          セラピスト管理
        </h1>
        <p className="text-sm text-neutral-textMuted">
          管理対象のセラピスト一覧を確認し、詳細は店舗編集から更新してください。
        </p>
      </div>

      {loading ? (
        <div className="rounded border border-dashed border-neutral-borderLight px-4 py-3 text-sm text-neutral-textMuted">
          読み込み中です…
        </div>
      ) : therapists.length === 0 ? (
        <div className="rounded border border-neutral-borderLight px-4 py-3 text-sm text-neutral-textMuted">
          表示できるセラピストが見つかりませんでした。
        </div>
      ) : (
        <ul className="space-y-2">
          {therapists.map((member) => (
            <li
              key={member.id}
              className="flex items-center justify-between rounded border border-neutral-borderLight bg-white px-3 py-2 text-sm"
            >
              <div className="space-y-0.5">
                <div className="font-semibold text-neutral-text">{member.name}</div>
                {member.headline ? (
                  <div className="text-xs text-neutral-textMuted">{member.headline}</div>
                ) : null}
                {member.shop ? (
                  <div className="text-xs text-neutral-textMuted">所属: {member.shop}</div>
                ) : null}
              </div>
              <span className="text-xs text-brand-primary">編集は店舗管理から</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
