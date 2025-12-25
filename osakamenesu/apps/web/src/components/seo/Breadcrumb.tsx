import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { generateBreadcrumbData, serializeStructuredData } from '@/lib/seo/structured-data'

export interface BreadcrumbItem {
  name: string
  url?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  className?: string
  showStructuredData?: boolean
}

export default function Breadcrumb({
  items,
  className = '',
  showStructuredData = true,
}: BreadcrumbProps) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://osakamenesu.com'

  // Generate structured data
  const structuredData = showStructuredData
    ? generateBreadcrumbData(items, baseUrl)
    : null

  return (
    <>
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeStructuredData(structuredData),
          }}
        />
      )}

      <nav
        aria-label="パンくずリスト"
        className={`flex items-center flex-wrap gap-2 text-sm ${className}`}
      >
        <Link
          href="/"
          className="text-neutral-textMuted hover:text-neutral-text transition-colors"
        >
          ホーム
        </Link>

        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-neutral-textMuted" />
            {item.url && index < items.length - 1 ? (
              <Link
                href={item.url}
                className="text-neutral-textMuted hover:text-neutral-text transition-colors"
              >
                {item.name}
              </Link>
            ) : (
              <span
                className="text-neutral-text font-medium"
                aria-current={index === items.length - 1 ? 'page' : undefined}
              >
                {item.name}
              </span>
            )}
          </div>
        ))}
      </nav>
    </>
  )
}