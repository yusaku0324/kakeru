'use client'

import { useState } from 'react'

import type { StaffItem } from '@/features/shops/model'
import { ShopStaffSection } from '@/features/shops/ui/ShopStaffSection'

const SAMPLE_STAFF: StaffItem[] = [
  {
    id: 'staff-kana',
    name: 'Kana',
    alias: 'かな',
    headline: '丁寧なリンパケアが得意',
    specialties: ['リンパ', 'ドライヘッド'],
  },
  {
    id: 'staff-rio',
    name: 'Rio',
    alias: 'りお',
    headline: 'オイルとストレッチの組み合わせコースを担当',
    specialties: ['ストレッチ'],
  },
]

export function ShopStaffSectionStory() {
  const [members, setMembers] = useState<StaffItem[]>(SAMPLE_STAFF)

  return (
    <div className="max-w-3xl space-y-4 rounded border border-slate-200 bg-slate-50 p-6">
      <ShopStaffSection
        staff={members}
        onUpdateStaff={(index, patch) =>
          setMembers(prev => prev.map((member, idx) => (idx === index ? { ...member, ...patch } : member)))
        }
        onAddStaff={() => setMembers(prev => [...prev, { id: `staff-${Date.now()}`, name: '', specialties: [] }])}
        onRemoveStaff={index => setMembers(prev => prev.filter((_, idx) => idx !== index))}
      />
    </div>
  )
}
