import type { MetadataRoute } from 'next'

const SITE_BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://osaka-menesu.com'

export default function robots(): MetadataRoute.Robots {
  const base = SITE_BASE.replace(/\/$/, '')
  return {
    rules: [
      {
        userAgent: '*',
        disallow: ['/dashboard', '/dashboard/*'],
      },
    ],
    sitemap: [`${base}/sitemap.xml`],
    host: base,
  }
}
