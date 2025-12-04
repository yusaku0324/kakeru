const path = require('path')
const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const INTERNAL_API_BASE =
  process.env.OSAKAMENESU_API_INTERNAL_BASE ||
  process.env.API_INTERNAL_BASE ||
  process.env.NEXT_PUBLIC_OSAKAMENESU_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE ||
  'http://osakamenesu-api:8000'

const normalizeBase = (base) => base.replace(/\/$/, '')

const nextConfig = {
  // Note: outputFileTracingRoot disabled due to Vercel build path issues
  // outputFileTracingRoot: path.join(__dirname, '../../'),
  experimental: {
    optimizeCss: true,
    webpackBuildWorker: true,
  },
  images: {
    // Allow typical dev sources; adjust for production as needed
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'images.pexels.com' },
      { protocol: 'https', hostname: 'example.com' },
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

// Export with Sentry configuration if DSN is available
const sentryWebpackPluginOptions = {
  // Suppresses source map uploading logs during build
  silent: true,
  // Routes browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers (increases server load)
  tunnelRoute: "/monitoring",
  // Hides source maps from generated client bundles
  hideSourceMaps: true,
  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,
}

// Only wrap with Sentry if DSN is configured
if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
  module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions)
} else {
  module.exports = nextConfig
}
