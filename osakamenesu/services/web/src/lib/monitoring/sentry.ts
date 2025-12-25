/**
 * Enhanced Sentry configuration and utilities for web application
 */

import * as Sentry from '@sentry/nextjs'
import { CaptureContext, Severity } from '@sentry/types'

/**
 * Custom error class for application errors
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public context?: Record<string, any>
  ) {
    super(message)
    this.name = 'AppError'
  }
}

/**
 * Initialize Sentry with enhanced configuration
 */
export function initSentry() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN

  if (!dsn) {
    console.warn('Sentry DSN not configured')
    return
  }

  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_ENVIRONMENT || 'production',
    tracesSampleRate: Number(
      process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || 0.1
    ),
    replaysSessionSampleRate: Number(
      process.env.NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE || 0.1
    ),
    replaysOnErrorSampleRate: Number(
      process.env.NEXT_PUBLIC_SENTRY_REPLAYS_ERROR_SAMPLE_RATE || 1.0
    ),
    beforeSend(event, hint) {
      // Filter out non-application errors
      if (event.exception) {
        const error = hint.originalException

        // Ignore common browser errors
        const ignoredErrors = [
          'ResizeObserver loop limit exceeded',
          'ResizeObserver loop completed with undelivered notifications',
          'Non-Error promise rejection captured',
          'Network request failed',
        ]

        if (
          typeof error === 'string' &&
          ignoredErrors.some(ignored => error.includes(ignored))
        ) {
          return null
        }

        // Filter out errors from browser extensions
        if (
          event.exception.values?.[0]?.stacktrace?.frames?.some(frame =>
            frame.filename?.includes('chrome-extension://')
          )
        ) {
          return null
        }
      }

      // Add custom context
      event.extra = {
        ...event.extra,
        sessionId: getSessionId(),
        timestamp: new Date().toISOString(),
      }

      return event
    },
    integrations: [
      // Session replay with privacy settings
      new Sentry.Replay({
        maskAllText: false,
        maskAllInputs: true,
        blockAllMedia: false,
        // Sample only error sessions and 10% of regular sessions
        sessionSampleRate: 0.1,
        errorSampleRate: 1.0,
        // Privacy settings
        maskTextSelector: '[data-sentry-mask]',
        blockSelector: '[data-sentry-block]',
        ignoreSelector: '[data-sentry-ignore]',
      }),
      // Browser tracing
      new Sentry.BrowserTracing({
        // Performance monitoring for Next.js routes
        routingInstrumentation: Sentry.nextRouterInstrumentation,
        // Trace fetch requests to backend
        traceFetch: true,
        // Trace XHR requests
        traceXHR: true,
        // Sample rate for automatic spans
        tracingOptions: {
          trackComponents: true,
        },
      }),
    ],
  })

  // Set initial user context
  setUserContext()
}

/**
 * Capture an exception with additional context
 */
export function captureException(
  error: Error | string | unknown,
  context?: CaptureContext
): string | undefined {
  if (!Sentry.getCurrentHub().getClient()) {
    console.error('Sentry not initialized', error)
    return
  }

  // Convert string errors to Error objects
  const errorObject =
    error instanceof Error ? error : new Error(String(error))

  // Add custom context
  const enhancedContext: CaptureContext = {
    ...context,
    tags: {
      ...context?.tags,
      component: context?.tags?.component || 'unknown',
    },
    extra: {
      ...context?.extra,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    },
  }

  return Sentry.captureException(errorObject, enhancedContext)
}

/**
 * Capture a message with severity level
 */
export function captureMessage(
  message: string,
  level: Severity = 'info',
  context?: CaptureContext
): string | undefined {
  if (!Sentry.getCurrentHub().getClient()) {
    console.log(`[${level.toUpperCase()}]`, message)
    return
  }

  return Sentry.captureMessage(message, level)
}

/**
 * Set user context for Sentry
 */
export function setUserContext(
  user?: {
    id?: string
    email?: string
    username?: string
  } | null
) {
  if (!user) {
    // Try to get user from local storage or session
    const storedUser = getUserFromStorage()
    if (storedUser) {
      Sentry.setUser({
        id: storedUser.id,
        email: storedUser.email,
        username: storedUser.username,
      })
    } else {
      Sentry.setUser(null)
    }
  } else {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.username,
    })
  }
}

/**
 * Add custom context to Sentry
 */
export function setContext(key: string, context: Record<string, any>) {
  Sentry.setContext(key, context)
}

/**
 * Add tags for categorization
 */
export function setTag(key: string, value: string | number | boolean) {
  Sentry.setTag(key, value)
}

/**
 * Add breadcrumb for better error tracking
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, any>
) {
  Sentry.addBreadcrumb({
    message,
    category,
    level: 'info',
    timestamp: Date.now() / 1000,
    data,
  })
}

/**
 * Start a performance transaction
 */
export function startTransaction(name: string, op: string) {
  return Sentry.startTransaction({
    name,
    op,
    tags: {
      component: 'web',
    },
  })
}

/**
 * Track user interactions
 */
export function trackInteraction(
  action: string,
  category: string,
  label?: string,
  value?: number
) {
  addBreadcrumb(`User ${action}`, category, {
    label,
    value,
  })

  // Also track as custom event
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value,
    })
  }
}

/**
 * Monitor async operations
 */
export async function withMonitoring<T>(
  operation: () => Promise<T>,
  options: {
    op: string
    name: string
    data?: Record<string, any>
  }
): Promise<T> {
  const transaction = startTransaction(options.name, options.op)

  if (options.data) {
    Object.entries(options.data).forEach(([key, value]) => {
      transaction.setData(key, value)
    })
  }

  try {
    const result = await operation()
    transaction.setStatus('ok')
    return result
  } catch (error) {
    transaction.setStatus('internal_error')
    captureException(error, {
      tags: {
        operation: options.op,
      },
      extra: options.data,
    })
    throw error
  } finally {
    transaction.finish()
  }
}

/**
 * Error boundary component helper
 */
export function logErrorToSentry(error: Error, errorInfo: { componentStack: string }) {
  captureException(error, {
    contexts: {
      react: {
        componentStack: errorInfo.componentStack,
      },
    },
    tags: {
      component: 'error-boundary',
    },
  })
}

// Helper functions

function getSessionId(): string {
  if (typeof window === 'undefined') return 'ssr'

  let sessionId = sessionStorage.getItem('sessionId')
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    sessionStorage.setItem('sessionId', sessionId)
  }
  return sessionId
}

function getUserFromStorage(): { id: string; email?: string; username?: string } | null {
  if (typeof window === 'undefined') return null

  try {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      return JSON.parse(userStr)
    }
  } catch (error) {
    // Ignore parsing errors
  }

  return null
}

// Declare gtag for TypeScript
declare global {
  interface Window {
    gtag?: (...args: any[]) => void
  }
}