import * as Sentry from '@sentry/nextjs'

const SLACK_WEBHOOK_URL = process.env.SLACK_ERROR_WEBHOOK_URL

async function postToSlack(message: string, context?: Record<string, unknown>) {
  if (!SLACK_WEBHOOK_URL) return
  try {
    await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: message,
        blocks: context
          ? [
              {
                type: 'section',
                text: { type: 'mrkdwn', text: `*${message}*` },
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: '```' + JSON.stringify(context, null, 2) + '```',
                },
              },
            ]
          : undefined,
      }),
    })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Failed to send Slack notification', error)
    }
  }
}

export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'development') {
    console.error('Captured error', error, context)
  }

  // Send to Sentry if configured
  if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
    if (error instanceof Error) {
      Sentry.captureException(error, {
        extra: context,
      })
    } else {
      Sentry.captureMessage(String(error), {
        level: 'error',
        extra: context,
      })
    }
  }

  // Also send to Slack for immediate notification
  const message =
    context?.message ||
    (error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error')
  postToSlack(`⚠️ エラー検知: ${message}`, context).catch(() => {})
}

export function withErrorReporting<Args extends any[], Result>(
  handler: (...args: Args) => Promise<Result> | Result,
  context: Record<string, unknown>,
) {
  return async (...args: Args) => {
    try {
      return await handler(...args)
    } catch (error) {
      captureError(error, context)
      throw error
    }
  }
}
