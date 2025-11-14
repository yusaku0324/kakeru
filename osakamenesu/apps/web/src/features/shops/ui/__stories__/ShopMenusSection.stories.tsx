'use client'

import { useState } from 'react'

import type { MenuItem } from '@/features/shops/model'
import { ShopMenusSection } from '@/features/shops/ui/ShopMenusSection'

const SAMPLE_MENUS: MenuItem[] = [
  {
    id: 'menu-aroma-60',
    name: 'アロマトリートメント 60分',
    price: 12000,
    duration_minutes: 60,
    description: '全身のリンパを流す基本コース',
    tags: ['アロマ', 'リンパ'],
    is_reservable_online: true,
  },
  {
    id: 'menu-dry-90',
    name: 'ドライトリートメント 90分',
    price: 15000,
    duration_minutes: 90,
    description: 'ストレッチを組み合わせたコース',
    tags: ['ドライ'],
    is_reservable_online: true,
  },
]

export function ShopMenusSectionStory() {
  const [menus, setMenus] = useState<MenuItem[]>(SAMPLE_MENUS)

  return (
    <div className="max-w-3xl space-y-4 rounded border border-slate-200 bg-slate-50 p-6">
      <ShopMenusSection
        menus={menus}
        onUpdateMenu={(index, patch) =>
          setMenus(prev => prev.map((menu, idx) => (idx === index ? { ...menu, ...patch } : menu)))
        }
        onAddMenu={() => setMenus(prev => [...prev, { id: `menu-${Date.now()}`, name: '', price: 0, tags: [] }])}
        onRemoveMenu={index => setMenus(prev => prev.filter((_, idx) => idx !== index))}
      />
    </div>
  )
}
