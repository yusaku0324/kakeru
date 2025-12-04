export type TrackPayload = Record<string, unknown> | undefined

type TrackFn = (event: string, payload?: TrackPayload) => void

// Google Analytics helper
const sendGoogleAnalytics = (event: string, payload?: TrackPayload) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', event, {
      event_category: 'engagement',
      event_label: payload?.label as string,
      value: payload?.value as number,
      ...payload,
    })
  }
}

// Mixpanel helper
const sendMixpanel = (event: string, payload?: TrackPayload) => {
  if (typeof window !== 'undefined' && window.mixpanel) {
    window.mixpanel.track(event, payload)
  }
}

const tracker: TrackFn = (event, payload) => {
  const detail = payload ?? {}

  // Development logging
  if (process.env.NODE_ENV === 'development') {
    console.log('[track]', event, detail)
  }

  // Production analytics
  if (process.env.NODE_ENV === 'production') {
    // Google Analytics
    if (process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID) {
      sendGoogleAnalytics(event, detail)
    }

    // Mixpanel
    if (process.env.NEXT_PUBLIC_MIXPANEL_TOKEN) {
      sendMixpanel(event, detail)
    }
  }
}

export const track: TrackFn = (event, payload) => {
  try {
    tracker(event, payload)
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[track:error]', error)
    }
  }
}

// Utility functions for common events
export const trackPageView = (page: string, properties?: TrackPayload) => {
  track('page_view', { page, ...properties })
}

export const trackSearch = (query: string, results: number, properties?: TrackPayload) => {
  track('search', { query, results, ...properties })
}

export const trackReservation = (therapistId: string, shopId: string, properties?: TrackPayload) => {
  track('reservation_created', { therapistId, shopId, ...properties })
}

export default track
