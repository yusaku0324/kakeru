'use client'

import { useState } from 'react'

import { Chip } from '@/components/ui/Chip'
import {
  contactStyleOptions,
  lookTypeOptions,
  moodTagOptions,
  normalizeHobbyTags,
  styleTagOptions,
  talkLevelOptions,
  type ProfileTagOption,
} from '@/features/therapist/profileTags'
import type { StaffItem } from '@/features/shops/model'

type ShopStaffSectionProps = {
  staff: StaffItem[]
  onUpdateStaff: (index: number, patch: Partial<StaffItem>) => void
  onAddStaff: () => void
  onRemoveStaff: (index: number) => void
}

type SelectFieldProps = {
  label: string
  placeholder?: string
  options: ProfileTagOption[]
  value?: string | null
  onChange: (value: string) => void
}

function SingleSelectField({ label, placeholder = '選択なし', options, value, onChange }: SelectFieldProps) {
  return (
    <label className="space-y-1 text-sm font-medium text-neutral-text">
      <span className="text-xs text-neutral-textMuted">{label}</span>
      <select
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded border px-3 py-2 text-sm"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function ShopStaffSection({
  staff,
  onUpdateStaff,
  onAddStaff,
  onRemoveStaff,
}: ShopStaffSectionProps) {
  const [hobbyDrafts, setHobbyDrafts] = useState<Record<number, string>>({})

  const handleSelectChange = (index: number, field: keyof StaffItem, rawValue: string) => {
    const normalized = rawValue.trim()
    const nextValue = normalized === '' ? null : normalized
    onUpdateStaff(index, { [field]: nextValue } as Partial<StaffItem>)
  }

  const handleAddHobby = (index: number) => {
    const draft = (hobbyDrafts[index] ?? '').trim()
    if (!draft) return
    const current = normalizeHobbyTags(staff[index]?.hobby_tags)
    if (current.includes(draft)) {
      setHobbyDrafts((prev) => ({ ...prev, [index]: '' }))
      return
    }
    onUpdateStaff(index, { hobby_tags: [...current, draft] })
    setHobbyDrafts((prev) => ({ ...prev, [index]: '' }))
  }

  const handleRemoveHobby = (index: number, tag: string) => {
    const current = normalizeHobbyTags(staff[index]?.hobby_tags)
    onUpdateStaff(index, { hobby_tags: current.filter((item) => item !== tag) })
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">スタッフ</h2>
        <button onClick={onAddStaff} className="rounded border px-3 py-1 text-sm" type="button">
          スタッフを追加
        </button>
      </div>
      <div className="space-y-3">
        {staff.map((member, idx) => {
          const hobbyTags = normalizeHobbyTags(member.hobby_tags)
          return (
            <div
              key={member.id || idx}
              className="space-y-3 rounded-lg border bg-white p-3 shadow-sm"
              data-testid="staff-item"
            >
              <div className="grid gap-2 md:grid-cols-2">
                <input
                  value={member.name}
                  onChange={(e) => onUpdateStaff(idx, { name: e.target.value })}
                  className="rounded border px-3 py-2 text-sm"
                  placeholder="名前"
                />
                <input
                  value={member.alias || ''}
                  onChange={(e) => onUpdateStaff(idx, { alias: e.target.value })}
                  className="rounded border px-3 py-2 text-sm"
                  placeholder="表示名"
                />
              </div>
              <textarea
                value={member.headline || ''}
                onChange={(e) => onUpdateStaff(idx, { headline: e.target.value })}
                className="w-full rounded border px-3 py-2 text-sm"
                rows={2}
                placeholder="紹介文"
              />

              <div className="grid gap-2 md:grid-cols-2">
                <SingleSelectField
                  label="雰囲気タグ"
                  options={moodTagOptions}
                  value={member.mood_tag}
                  onChange={(value) => handleSelectChange(idx, 'mood_tag', value)}
                />
                <SingleSelectField
                  label="施術スタイル"
                  options={styleTagOptions}
                  value={member.style_tag}
                  onChange={(value) => handleSelectChange(idx, 'style_tag', value)}
                />
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <SingleSelectField
                  label="第一印象のタイプ"
                  options={lookTypeOptions}
                  value={member.look_type}
                  onChange={(value) => handleSelectChange(idx, 'look_type', value)}
                />
                <SingleSelectField
                  label="距離感スタイル"
                  options={contactStyleOptions}
                  value={member.contact_style}
                  onChange={(value) => handleSelectChange(idx, 'contact_style', value)}
                />
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <SingleSelectField
                  label="会話のテンポ"
                  options={talkLevelOptions}
                  value={member.talk_level}
                  onChange={(value) => handleSelectChange(idx, 'talk_level', value)}
                />
                <input
                  value={(member.specialties || []).join(', ')}
                  onChange={(e) =>
                    onUpdateStaff(idx, {
                      specialties: e.target.value
                        .split(',')
                        .map((tag) => tag.trim())
                        .filter(Boolean),
                    })
                  }
                  className="rounded border px-3 py-2 text-sm"
                  placeholder="得意分野 (カンマ区切り)"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-xs font-semibold text-neutral-text">趣味・会話ネタ</span>
                  <span className="text-[11px] text-neutral-textMuted">
                    Enterキーで追加／クリックで削除
                  </span>
                </div>
                {hobbyTags.length ? (
                  <div className="flex flex-wrap gap-2">
                    {hobbyTags.map((tag) => (
                      <Chip key={tag} variant="subtle">
                        {tag}
                        <button
                          type="button"
                          aria-label={`${tag} を削除`}
                          className="ml-2 text-xs text-neutral-textMuted hover:text-red-600"
                          onClick={() => handleRemoveHobby(idx, tag)}
                        >
                          ×
                        </button>
                      </Chip>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-neutral-textMuted">
                    例: 映画 / カフェ巡り / スポーツ観戦
                  </p>
                )}
                <div className="flex gap-2">
                  <input
                    value={hobbyDrafts[idx] ?? ''}
                    onChange={(e) =>
                      setHobbyDrafts((prev) => ({ ...prev, [idx]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddHobby(idx)
                      }
                    }}
                    className="w-full rounded border px-3 py-2 text-sm"
                    placeholder="趣味タグを入力して追加"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddHobby(idx)}
                    className="rounded border bg-neutral-surfaceAlt px-3 py-2 text-sm font-semibold"
                  >
                    追加
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => onRemoveStaff(idx)}
                  className="text-xs text-red-600"
                  type="button"
                >
                  削除
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
