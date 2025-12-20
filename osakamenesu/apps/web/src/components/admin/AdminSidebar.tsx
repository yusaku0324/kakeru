'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'

type NavItem = {
  label: string
  href: string
  icon: string
}

const navItems: NavItem[] = [
  { label: '予約管理', href: '/admin/reservations', icon: '📅' },
  { label: '店舗管理', href: '/admin/shops', icon: '🏪' },
  { label: 'セラピスト', href: '/admin/therapists', icon: '👤' },
]

export function AdminSidebar() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/admin/reservations') {
      return pathname === href || pathname.includes('/reservations')
    }
    if (href === '/admin/shops') {
      return pathname.startsWith('/admin/shops')
    }
    if (href === '/admin/therapists') {
      return pathname.startsWith('/admin/therapists')
    }
    return pathname === href
  }

  return (
    <aside className="fixed left-0 top-[41px] z-40 h-[calc(100vh-41px)] w-56 border-r border-neutral-200 bg-white">
      <nav className="flex flex-col gap-1 p-3">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              isActive(item.href)
                ? 'bg-brand-primary/10 text-brand-primary'
                : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
            )}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="absolute bottom-0 left-0 right-0 border-t border-neutral-200 p-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
        >
          <span className="text-base">←</span>
          ダッシュボードに戻る
        </Link>
      </div>
    </aside>
  )
}
