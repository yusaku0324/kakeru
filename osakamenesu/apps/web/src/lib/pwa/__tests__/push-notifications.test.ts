/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  isPushNotificationSupported,
  requestNotificationPermission,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  getCurrentSubscription,
  sendTestNotification,
} from '../push-notifications'

describe('push-notifications', () => {
  const originalNavigator = global.navigator
  const originalNotification = global.Notification

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Restore originals
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
    })
    global.Notification = originalNotification
  })

  describe('isPushNotificationSupported', () => {
    it('returns true when all APIs are available', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          serviceWorker: {},
        },
        writable: true,
      })
      Object.defineProperty(window, 'PushManager', {
        value: class PushManager {},
        writable: true,
      })
      // @ts-expect-error - Notification mock
      global.Notification = class Notification {}

      expect(isPushNotificationSupported()).toBe(true)
    })

    it('returns false when serviceWorker is missing', () => {
      Object.defineProperty(global, 'navigator', {
        value: {},
        writable: true,
      })
      Object.defineProperty(window, 'PushManager', {
        value: class PushManager {},
        writable: true,
      })
      // @ts-expect-error - Notification mock
      global.Notification = class Notification {}

      expect(isPushNotificationSupported()).toBe(false)
    })

    // Note: PushManager and Notification cannot be removed in jsdom environment,
    // so we only test the serviceWorker check for the false case
  })

  describe('requestNotificationPermission', () => {
    it('throws error when push not supported', async () => {
      Object.defineProperty(global, 'navigator', {
        value: {},
        writable: true,
      })

      await expect(requestNotificationPermission()).rejects.toThrow(
        'プッシュ通知はサポートされていません'
      )
    })

    it('returns granted permission', async () => {
      Object.defineProperty(global, 'navigator', {
        value: { serviceWorker: {} },
        writable: true,
      })
      Object.defineProperty(window, 'PushManager', {
        value: class PushManager {},
        writable: true,
      })
      // @ts-expect-error - Notification mock
      global.Notification = {
        requestPermission: vi.fn().mockResolvedValue('granted'),
      }

      const result = await requestNotificationPermission()
      expect(result).toBe('granted')
    })

    it('logs warning when permission denied', async () => {
      Object.defineProperty(global, 'navigator', {
        value: { serviceWorker: {} },
        writable: true,
      })
      Object.defineProperty(window, 'PushManager', {
        value: class PushManager {},
        writable: true,
      })
      // @ts-expect-error - Notification mock
      global.Notification = {
        requestPermission: vi.fn().mockResolvedValue('denied'),
      }
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await requestNotificationPermission()

      expect(result).toBe('denied')
      expect(warnSpy).toHaveBeenCalledWith(
        '通知がブロックされています: ブラウザの設定から通知を許可してください'
      )
      warnSpy.mockRestore()
    })
  })

  describe('subscribeToPushNotifications', () => {
    it('throws error when push not supported', async () => {
      Object.defineProperty(global, 'navigator', {
        value: {},
        writable: true,
      })

      await expect(subscribeToPushNotifications()).rejects.toThrow(
        'プッシュ通知はサポートされていません'
      )
    })

    it('returns null when VAPID key not set', async () => {
      Object.defineProperty(global, 'navigator', {
        value: { serviceWorker: {} },
        writable: true,
      })
      Object.defineProperty(window, 'PushManager', {
        value: class PushManager {},
        writable: true,
      })
      // @ts-expect-error - Notification mock
      global.Notification = class Notification {}

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await subscribeToPushNotifications()

      expect(result).toBeNull()
      expect(errorSpy).toHaveBeenCalledWith('VAPID公開鍵が設定されていません')
      errorSpy.mockRestore()
    })

    it('returns existing subscription when already subscribed', async () => {
      // Set VAPID key via module re-import with mocked env
      vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'BNbxGYNMhEIi7iGnhfL7K1H4v6S9d7c0Y0t2jLqOqZMj1E4p5H8k2E8hQ6w9xJfQgWdK3nZmPpRtVuWsYaObCdE')

      // Re-import the module to pick up the mocked env
      vi.resetModules()
      const { subscribeToPushNotifications: subscribe } = await import('../push-notifications')

      const mockExistingSubscription = { endpoint: 'https://push.example.com/existing' }
      const mockRegistration = {
        pushManager: {
          getSubscription: vi.fn().mockResolvedValue(mockExistingSubscription),
        },
      }
      Object.defineProperty(global, 'navigator', {
        value: {
          serviceWorker: {
            ready: Promise.resolve(mockRegistration),
          },
        },
        writable: true,
      })
      Object.defineProperty(window, 'PushManager', {
        value: class PushManager {},
        writable: true,
      })
      // @ts-expect-error - Notification mock
      global.Notification = class Notification {}

      const result = await subscribe()

      expect(result).toBe(mockExistingSubscription)
      expect(mockRegistration.pushManager.getSubscription).toHaveBeenCalled()

      vi.unstubAllEnvs()
    })

    it('creates new subscription when no existing subscription', async () => {
      vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'BNbxGYNMhEIi7iGnhfL7K1H4v6S9d7c0Y0t2jLqOqZMj1E4p5H8k2E8hQ6w9xJfQgWdK3nZmPpRtVuWsYaObCdE')

      vi.resetModules()
      const { subscribeToPushNotifications: subscribe } = await import('../push-notifications')

      const mockNewSubscription = { endpoint: 'https://push.example.com/new' }
      const mockSubscribe = vi.fn().mockResolvedValue(mockNewSubscription)
      const mockRegistration = {
        pushManager: {
          getSubscription: vi.fn().mockResolvedValue(null),
          subscribe: mockSubscribe,
        },
      }
      Object.defineProperty(global, 'navigator', {
        value: {
          serviceWorker: {
            ready: Promise.resolve(mockRegistration),
          },
        },
        writable: true,
      })
      Object.defineProperty(window, 'PushManager', {
        value: class PushManager {},
        writable: true,
      })
      // @ts-expect-error - Notification mock
      global.Notification = class Notification {}

      const result = await subscribe()

      expect(result).toBe(mockNewSubscription)
      expect(mockSubscribe).toHaveBeenCalledWith({
        userVisibleOnly: true,
        applicationServerKey: expect.any(Uint8Array),
      })

      vi.unstubAllEnvs()
    })

    it('returns null and logs error on subscription failure', async () => {
      vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'BNbxGYNMhEIi7iGnhfL7K1H4v6S9d7c0Y0t2jLqOqZMj1E4p5H8k2E8hQ6w9xJfQgWdK3nZmPpRtVuWsYaObCdE')

      vi.resetModules()
      const { subscribeToPushNotifications: subscribe } = await import('../push-notifications')

      const mockError = new Error('Subscription failed')
      const mockRegistration = {
        pushManager: {
          getSubscription: vi.fn().mockResolvedValue(null),
          subscribe: vi.fn().mockRejectedValue(mockError),
        },
      }
      Object.defineProperty(global, 'navigator', {
        value: {
          serviceWorker: {
            ready: Promise.resolve(mockRegistration),
          },
        },
        writable: true,
      })
      Object.defineProperty(window, 'PushManager', {
        value: class PushManager {},
        writable: true,
      })
      // @ts-expect-error - Notification mock
      global.Notification = class Notification {}

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await subscribe()

      expect(result).toBeNull()
      expect(errorSpy).toHaveBeenCalledWith('プッシュ通知の購読に失敗:', mockError)
      expect(warnSpy).toHaveBeenCalledWith('プッシュ通知の登録に失敗しました: 時間をおいて再度お試しください')

      errorSpy.mockRestore()
      warnSpy.mockRestore()
      vi.unstubAllEnvs()
    })
  })

  describe('unsubscribeFromPushNotifications', () => {
    it('returns false when push not supported', async () => {
      Object.defineProperty(global, 'navigator', {
        value: {},
        writable: true,
      })

      const result = await unsubscribeFromPushNotifications()
      expect(result).toBe(false)
    })

    it('returns true when already unsubscribed', async () => {
      const mockRegistration = {
        pushManager: {
          getSubscription: vi.fn().mockResolvedValue(null),
        },
      }
      Object.defineProperty(global, 'navigator', {
        value: {
          serviceWorker: {
            ready: Promise.resolve(mockRegistration),
          },
        },
        writable: true,
      })
      Object.defineProperty(window, 'PushManager', {
        value: class PushManager {},
        writable: true,
      })
      // @ts-expect-error - Notification mock
      global.Notification = class Notification {}

      const result = await unsubscribeFromPushNotifications()
      expect(result).toBe(true)
    })

    it('unsubscribes from existing subscription', async () => {
      const mockSubscription = {
        unsubscribe: vi.fn().mockResolvedValue(true),
      }
      const mockRegistration = {
        pushManager: {
          getSubscription: vi.fn().mockResolvedValue(mockSubscription),
        },
      }
      Object.defineProperty(global, 'navigator', {
        value: {
          serviceWorker: {
            ready: Promise.resolve(mockRegistration),
          },
        },
        writable: true,
      })
      Object.defineProperty(window, 'PushManager', {
        value: class PushManager {},
        writable: true,
      })
      // @ts-expect-error - Notification mock
      global.Notification = class Notification {}

      const result = await unsubscribeFromPushNotifications()

      expect(result).toBe(true)
      expect(mockSubscription.unsubscribe).toHaveBeenCalled()
    })

    it('returns false on error', async () => {
      const mockRegistration = {
        pushManager: {
          getSubscription: vi.fn().mockRejectedValue(new Error('Network error')),
        },
      }
      Object.defineProperty(global, 'navigator', {
        value: {
          serviceWorker: {
            ready: Promise.resolve(mockRegistration),
          },
        },
        writable: true,
      })
      Object.defineProperty(window, 'PushManager', {
        value: class PushManager {},
        writable: true,
      })
      // @ts-expect-error - Notification mock
      global.Notification = class Notification {}

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await unsubscribeFromPushNotifications()

      expect(result).toBe(false)
      errorSpy.mockRestore()
    })
  })

  describe('getCurrentSubscription', () => {
    it('returns null when push not supported', async () => {
      Object.defineProperty(global, 'navigator', {
        value: {},
        writable: true,
      })

      const result = await getCurrentSubscription()
      expect(result).toBeNull()
    })

    it('returns current subscription', async () => {
      const mockSubscription = { endpoint: 'https://push.example.com' }
      const mockRegistration = {
        pushManager: {
          getSubscription: vi.fn().mockResolvedValue(mockSubscription),
        },
      }
      Object.defineProperty(global, 'navigator', {
        value: {
          serviceWorker: {
            ready: Promise.resolve(mockRegistration),
          },
        },
        writable: true,
      })
      Object.defineProperty(window, 'PushManager', {
        value: class PushManager {},
        writable: true,
      })
      // @ts-expect-error - Notification mock
      global.Notification = class Notification {}

      const result = await getCurrentSubscription()

      expect(result).toBe(mockSubscription)
    })

    it('returns null on error', async () => {
      const mockRegistration = {
        pushManager: {
          getSubscription: vi.fn().mockRejectedValue(new Error('Error')),
        },
      }
      Object.defineProperty(global, 'navigator', {
        value: {
          serviceWorker: {
            ready: Promise.resolve(mockRegistration),
          },
        },
        writable: true,
      })
      Object.defineProperty(window, 'PushManager', {
        value: class PushManager {},
        writable: true,
      })
      // @ts-expect-error - Notification mock
      global.Notification = class Notification {}

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await getCurrentSubscription()

      expect(result).toBeNull()
      errorSpy.mockRestore()
    })
  })

  describe('sendTestNotification', () => {
    it('throws error when Notification not supported', async () => {
      // Save original and delete Notification
      const originalNotification = window.Notification
      // @ts-ignore - Temporarily delete for testing
      delete window.Notification

      await expect(sendTestNotification()).rejects.toThrow(
        'このブラウザは通知をサポートしていません'
      )

      // Restore
      window.Notification = originalNotification
    })

    it('throws error when permission not granted', async () => {
      Object.defineProperty(window, 'Notification', {
        value: {
          permission: 'denied',
        },
        writable: true,
        configurable: true,
      })

      await expect(sendTestNotification()).rejects.toThrow(
        '通知の権限が許可されていません'
      )
    })

    it('creates notification when permission granted', async () => {
      const mockClose = vi.fn()
      let capturedOnclick: (() => void) | null = null

      class MockNotification {
        static permission = 'granted'
        onclick: (() => void) | null = null
        close = mockClose

        constructor(
          public title: string,
          public options: NotificationOptions
        ) {
          // Capture onclick setter
          Object.defineProperty(this, 'onclick', {
            set: (fn: () => void) => {
              capturedOnclick = fn
            },
            get: () => capturedOnclick,
          })
        }
      }

      Object.defineProperty(window, 'Notification', {
        value: MockNotification,
        writable: true,
        configurable: true,
      })

      await sendTestNotification()

      // Verify notification was created (no direct assertion on constructor call)
      expect(capturedOnclick).not.toBeNull()
    })

    it('handles notification click', async () => {
      const mockClose = vi.fn()
      let capturedOnclick: (() => void) | null = null

      class MockNotification {
        static permission = 'granted'
        onclick: (() => void) | null = null
        close = mockClose

        constructor(
          public title: string,
          public options: NotificationOptions
        ) {
          Object.defineProperty(this, 'onclick', {
            set: (fn: () => void) => {
              capturedOnclick = fn
            },
            get: () => capturedOnclick,
          })
        }
      }

      Object.defineProperty(window, 'Notification', {
        value: MockNotification,
        writable: true,
        configurable: true,
      })

      const focusSpy = vi.spyOn(window, 'focus').mockImplementation(() => {})

      await sendTestNotification()

      // Simulate click
      capturedOnclick?.()

      expect(mockClose).toHaveBeenCalled()
      expect(focusSpy).toHaveBeenCalled()
      focusSpy.mockRestore()
    })
  })
})
