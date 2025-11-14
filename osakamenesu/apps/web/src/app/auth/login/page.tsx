import Link from 'next/link'

import { SiteLoginContent } from './SiteLoginContent'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function SiteLoginPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#ecfeff_0%,rgba(236,254,255,0)_65%),linear-gradient(180deg,#f0f8ff_0%,#ffffff_100%)] text-neutral-text">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_bottom_right,#dbeafe_0%,rgba(219,234,254,0)_60%)] blur-3xl opacity-70" />
      <SiteLoginContent variant="page" />
    </main>
  )
}
