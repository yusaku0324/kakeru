import type { MetadataRoute } from 'next'

const SITE_BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://osakamenesu.com'

export default function robots(): MetadataRoute.Robots {
  const base = SITE_BASE.replace(/\/$/, '')
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard',
          '/dashboard/*',
          '/admin',
          '/admin/*',
          '/auth',
          '/auth/*',
          '/api',
          '/api/*',
          '/_next',
          '/_next/*',
        ],
      },
    ],
    sitemap: [`${base}/sitemap.xml`],
    host: base,
  }
}
