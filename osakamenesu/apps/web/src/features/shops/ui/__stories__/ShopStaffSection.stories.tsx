'use client'

import { useState } from 'react'

import { ShopStaffSection } from '@/features/shops/ui/ShopStaffSection'

const SAMPLE_STAFF = [
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

function ShopStaffSectionPreview() {
  const [members, setMembers] = useState(SAMPLE_STAFF)

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

const meta = {
  title: 'Features/Shops/ShopStaffSection',
  component: ShopStaffSection,
  parameters: {
    layout: 'centered',
  },
}

export default meta

export const Default = {
  render: () => <ShopStaffSectionPreview />,
}
