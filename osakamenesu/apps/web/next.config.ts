import type { NextConfig } from 'next'

const INTERNAL_API_BASE =
  process.env.OSAKAMENESU_API_INTERNAL_BASE ||
  process.env.API_INTERNAL_BASE ||
  process.env.NEXT_PUBLIC_OSAKAMENESU_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE ||
  'http://osakamenesu-api:8000'

const normalizeBase = (base: string) => base.replace(/\/$/, '')

const enableCacheComponents = false

if (!process.env.NEXT_DISABLE_REACT_COMPILER) {
  process.env.NEXT_DISABLE_REACT_COMPILER = '1'
}
const enableReactCompiler = process.env.NEXT_DISABLE_REACT_COMPILER === '1' ? false : true

if (!process.env.NEXT_PUBLIC_ADMIN_BASIC_AUTH && process.env.ADMIN_BASIC_USER && process.env.ADMIN_BASIC_PASS) {
  const token = Buffer.from(`${process.env.ADMIN_BASIC_USER}:${process.env.ADMIN_BASIC_PASS}`).toString('base64')
  process.env.NEXT_PUBLIC_ADMIN_BASIC_AUTH = `Basic ${token}`
}

if (!process.env.NEXT_PUBLIC_ADMIN_API_KEY && process.env.ADMIN_API_KEY) {
  process.env.NEXT_PUBLIC_ADMIN_API_KEY = process.env.ADMIN_API_KEY
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'images.pexels.com' },
      { protocol: 'https', hostname: 'i.pravatar.cc' },
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
    ],
  },
  cacheComponents: enableCacheComponents,
  reactCompiler: enableReactCompiler,
  experimental: {},
  async rewrites() {
    const base = normalizeBase(INTERNAL_API_BASE)
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [
        {
          source: '/api/line/:path*',
          destination: `${base}/api/line/:path*`,
        },
        {
          source: '/api/async/:path*',
          destination: `${base}/api/async/:path*`,
        },
      ],
    }
  },
}

export default nextConfig
