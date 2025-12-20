'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMemo } from 'react'

type BreadcrumbItem = {
  label: string
  href?: string
}

// パス名から日本語ラベルへのマッピング
const pathLabels: Record<string, string> = {
  admin: '管理画面',
  reservations: '予約管理',
  shops: '店舗管理',
  therapists: 'セラピスト',
  edit: '編集',
  shifts: 'シフト管理',
  settings: '設定',
}

export function AdminBreadcrumb() {
  const pathname = usePathname()

  const breadcrumbs = useMemo<BreadcrumbItem[]>(() => {
    const segments = pathname.split('/').filter(Boolean)
    const items: BreadcrumbItem[] = []
    let currentPath = ''

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]
      currentPath += `/${segment}`

      // Skip the first 'admin' segment as it's shown in header
      if (i === 0 && segment === 'admin') {
        continue
      }

      // Check if this is a dynamic segment (UUID or ID)
      const isDynamic = /^[0-9a-f-]{8,}$/i.test(segment)

      if (isDynamic) {
        // For dynamic segments, we'll show a shortened version or contextual label
        const prevSegment = segments[i - 1]
        let label = segment.slice(0, 8) + '...'

        if (prevSegment === 'shops') {
          label = '店舗詳細'
        } else if (prevSegment === 'therapists') {
          label = 'セラピスト詳細'
        } else if (prevSegment === 'reservations') {
          label = '予約詳細'
        }

        items.push({
          label,
          href: i < segments.length - 1 ? currentPath : undefined,
        })
      } else {
        // For known segments, use the label mapping
        const label = pathLabels[segment] || segment
        items.push({
          label,
          href: i < segments.length - 1 ? currentPath : undefined,
        })
      }
    }

    return items
  }, [pathname])

  if (breadcrumbs.length === 0) {
    return null
  }

  return (
    <nav aria-label="パンくずリスト" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm">
        <li>
          <Link
            href="/admin/reservations"
            className="text-neutral-500 hover:text-neutral-700"
          >
            管理画面
          </Link>
        </li>
        {breadcrumbs.map((item, index) => (
          <li key={index} className="flex items-center gap-1.5">
            <span className="text-neutral-300">/</span>
            {item.href ? (
              <Link
                href={item.href}
                className="text-neutral-500 hover:text-neutral-700"
              >
                {item.label}
              </Link>
            ) : (
              <span className="font-medium text-neutral-900">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
