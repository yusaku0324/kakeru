import * as Sentry from '@sentry/nextjs'
import { captureConsoleIntegration } from '@sentry/nextjs'

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    enableTracing: true,
    integrations: [
      captureConsoleIntegration({
        levels: ['error'],
      }),
    ],
  })
}
