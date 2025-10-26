const path = require('path')

/** @type {import('next').NextConfig} */
const INTERNAL_API_BASE =
  process.env.OSAKAMENESU_API_INTERNAL_BASE ||
  process.env.API_INTERNAL_BASE ||
  process.env.NEXT_PUBLIC_OSAKAMENESU_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE ||
  'http://osakamenesu-api:8000'

const normalizeBase = (base) => base.replace(/\/$/, '')

const nextConfig = {
  images: {
    // Allow typical dev sources; adjust for production as needed
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'images.pexels.com' },
      { protocol: 'https', hostname: 'i.pravatar.cc' },
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
    ],
  },
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      // Fall back to the API container only when Next.js has no matching route on disk
      fallback: [
        {
          source: '/api/:path*',
          destination: `${normalizeBase(INTERNAL_API_BASE)}/api/:path*`,
        },
      ],
    }
  },
  webpack(config) {
    config.resolve.alias['@'] = path.resolve(__dirname, 'src')
    return config
  },
}

module.exports = nextConfig
