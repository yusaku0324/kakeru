// Google Analytics types
declare global {
  interface Window {
    gtag?: (
      command: 'config' | 'event' | 'set',
      targetId: string,
      config?: Record<string, any>
    ) => void
    dataLayer?: Array<Record<string, any>>
    mixpanel?: {
      track: (event: string, properties?: Record<string, any>) => void
      identify: (userId: string) => void
      people: {
        set: (properties: Record<string, any>) => void
      }
      init: (token: string, config?: Record<string, any>) => void
    }
  }
}

export {}