/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  useInstallPWA,
  registerServiceWorker,
  unregisterServiceWorker,
  requestNotificationPermission,
  subscribeToPushNotifications,
  usePushNotifications,
  isStandalone,
  getDisplayMode,
  useOnlineStatus,
} from '../index'

describe('pwa/index', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('isStandalone', () => {
    it('returns false on server side', () => {
      const originalWindow = global.window
      delete global.window

      expect(isStandalone()).toBe(false)

      global.window = originalWindow
    })

    it('returns true when in standalone display mode', () => {
      const mockMatchMedia = vi.fn().mockReturnValue({ matches: true })
      window.matchMedia = mockMatchMedia

      expect(isStandalone()).toBe(true)
    })

    it('returns true when navigator.standalone is true (iOS)', () => {
      const mockMatchMedia = vi.fn().mockReturnValue({ matches: false })
      window.matchMedia = mockMatchMedia
      ;(window.navigator as any).standalone = true

      expect(isStandalone()).toBe(true)

      delete (window.navigator as any).standalone
    })

    it('returns true when opened from Android app', () => {
      const mockMatchMedia = vi.fn().mockReturnValue({ matches: false })
      window.matchMedia = mockMatchMedia

      Object.defineProperty(document, 'referrer', {
        value: 'android-app://com.example.app',
        configurable: true,
      })

      expect(isStandalone()).toBe(true)

      Object.defineProperty(document, 'referrer', {
        value: '',
        configurable: true,
      })
    })

    it('returns false in browser mode', () => {
      const mockMatchMedia = vi.fn().mockReturnValue({ matches: false })
      window.matchMedia = mockMatchMedia

      expect(isStandalone()).toBe(false)
    })
  })

  describe('getDisplayMode', () => {
    it('returns browser on server side', () => {
      const originalWindow = global.window
      delete global.window

      expect(getDisplayMode()).toBe('browser')

      global.window = originalWindow
    })

    it('returns fullscreen when in fullscreen mode', () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query === '(display-mode: fullscreen)',
      }))

      expect(getDisplayMode()).toBe('fullscreen')
    })

    it('returns standalone when in standalone mode', () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query === '(display-mode: standalone)',
      }))

      expect(getDisplayMode()).toBe('standalone')
    })

    it('returns minimal-ui when in minimal-ui mode', () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query === '(display-mode: minimal-ui)',
      }))

      expect(getDisplayMode()).toBe('minimal-ui')
    })

    it('returns browser as default', () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query === '(display-mode: browser)',
      }))

      expect(getDisplayMode()).toBe('browser')
    })
  })

  describe('requestNotificationPermission', () => {
    it('returns denied when Notification not supported', async () => {
      const originalNotification = window.Notification
      delete window.Notification

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await requestNotificationPermission()

      expect(result).toBe('denied')
      expect(warnSpy).toHaveBeenCalledWith('This browser does not support notifications')

      window.Notification = originalNotification
      warnSpy.mockRestore()
    })

    it('returns granted when already granted', async () => {
      Object.defineProperty(window, 'Notification', {
        value: { permission: 'granted' },
        configurable: true,
      })

      const result = await requestNotificationPermission()

      expect(result).toBe('granted')
    })

    it('returns denied when already denied', async () => {
      Object.defineProperty(window, 'Notification', {
        value: { permission: 'denied' },
        configurable: true,
      })

      const result = await requestNotificationPermission()

      expect(result).toBe('denied')
    })

    it('requests permission when default', async () => {
      const mockRequestPermission = vi.fn().mockResolvedValue('granted')
      Object.defineProperty(window, 'Notification', {
        value: {
          permission: 'default',
          requestPermission: mockRequestPermission,
        },
        configurable: true,
      })

      const result = await requestNotificationPermission()

      expect(mockRequestPermission).toHaveBeenCalled()
      expect(result).toBe('granted')
    })
  })

  describe('registerServiceWorker', () => {
    it('returns null on server side', async () => {
      const originalWindow = global.window
      delete global.window

      const result = await registerServiceWorker()

      expect(result).toBeNull()

      global.window = originalWindow
    })

    it('returns null when serviceWorker not supported', async () => {
      const originalServiceWorker = navigator.serviceWorker
      Object.defineProperty(navigator, 'serviceWorker', {
        value: undefined,
        configurable: true,
      })

      const result = await registerServiceWorker()

      expect(result).toBeNull()

      Object.defineProperty(navigator, 'serviceWorker', {
        value: originalServiceWorker,
        configurable: true,
      })
    })

    it('registers service worker successfully', async () => {
      const mockRegistration = {
        scope: '/',
        addEventListener: vi.fn(),
      }

      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          register: vi.fn().mockResolvedValue(mockRegistration),
        },
        configurable: true,
      })

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const result = await registerServiceWorker()

      expect(result).toBe(mockRegistration)
      expect(consoleSpy).toHaveBeenCalledWith('Service Worker registered:', '/')

      consoleSpy.mockRestore()
    })

    it('returns null on registration failure', async () => {
      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          register: vi.fn().mockRejectedValue(new Error('Registration failed')),
        },
        configurable: true,
      })

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await registerServiceWorker()

      expect(result).toBeNull()
      expect(errorSpy).toHaveBeenCalled()

      errorSpy.mockRestore()
    })
  })

  describe('unregisterServiceWorker', () => {
    it('does nothing on server side', async () => {
      const originalWindow = global.window
      delete global.window

      await expect(unregisterServiceWorker()).resolves.toBeUndefined()

      global.window = originalWindow
    })

    it('does nothing when serviceWorker not in navigator', async () => {
      // Store original
      const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker')

      // Remove the property completely
      // @ts-expect-error - Temporarily removing serviceWorker for testing
      delete navigator.serviceWorker

      await expect(unregisterServiceWorker()).resolves.toBeUndefined()

      // Restore
      if (originalDescriptor) {
        Object.defineProperty(navigator, 'serviceWorker', originalDescriptor)
      }
    })

    it('unregisters all service workers', async () => {
      const mockUnregister1 = vi.fn().mockResolvedValue(true)
      const mockUnregister2 = vi.fn().mockResolvedValue(true)

      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          getRegistrations: vi.fn().mockResolvedValue([
            { unregister: mockUnregister1 },
            { unregister: mockUnregister2 },
          ]),
        },
        configurable: true,
      })

      await unregisterServiceWorker()

      expect(mockUnregister1).toHaveBeenCalled()
      expect(mockUnregister2).toHaveBeenCalled()
    })
  })

  describe('subscribeToPushNotifications', () => {
    it('returns null when PushManager not supported', async () => {
      const originalPushManager = window.PushManager
      delete window.PushManager

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const mockRegistration = {} as ServiceWorkerRegistration

      const result = await subscribeToPushNotifications(mockRegistration, 'test-key')

      expect(result).toBeNull()
      expect(warnSpy).toHaveBeenCalledWith('Push notifications are not supported')

      window.PushManager = originalPushManager
      warnSpy.mockRestore()
    })

    it('returns null when permission denied', async () => {
      Object.defineProperty(window, 'PushManager', {
        value: class PushManager {},
        configurable: true,
      })

      Object.defineProperty(window, 'Notification', {
        value: { permission: 'denied' },
        configurable: true,
      })

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const mockRegistration = {} as ServiceWorkerRegistration

      const result = await subscribeToPushNotifications(mockRegistration, 'test-key')

      expect(result).toBeNull()

      warnSpy.mockRestore()
    })
  })

  describe('useOnlineStatus', () => {
    it('returns true initially when online', () => {
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        configurable: true,
      })

      const { result } = renderHook(() => useOnlineStatus())

      expect(result.current).toBe(true)
    })

    it('returns false initially when offline', () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        configurable: true,
      })

      const { result } = renderHook(() => useOnlineStatus())

      expect(result.current).toBe(false)
    })

    it('updates when going offline', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        configurable: true,
      })

      const { result } = renderHook(() => useOnlineStatus())

      expect(result.current).toBe(true)

      await act(async () => {
        window.dispatchEvent(new Event('offline'))
      })

      expect(result.current).toBe(false)
    })

    it('updates when going online', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        configurable: true,
      })

      const { result } = renderHook(() => useOnlineStatus())

      expect(result.current).toBe(false)

      await act(async () => {
        window.dispatchEvent(new Event('online'))
      })

      expect(result.current).toBe(true)
    })
  })

  describe('useInstallPWA', () => {
    beforeEach(() => {
      // Default: not in standalone mode
      window.matchMedia = vi.fn().mockReturnValue({ matches: false })
    })

    it('returns not installable initially', () => {
      const { result } = renderHook(() => useInstallPWA())

      expect(result.current.isInstallable).toBe(false)
      expect(result.current.isInstalled).toBe(false)
    })

    it('detects already installed (standalone mode)', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: true })

      const { result } = renderHook(() => useInstallPWA())

      expect(result.current.isInstalled).toBe(true)
    })

    it('detects iOS device', () => {
      const originalUserAgent = navigator.userAgent
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        configurable: true,
      })

      const { result } = renderHook(() => useInstallPWA())

      expect(result.current.isIOS).toBe(true)

      Object.defineProperty(navigator, 'userAgent', {
        value: originalUserAgent,
        configurable: true,
      })
    })

    it('sets installable on beforeinstallprompt event', async () => {
      const { result } = renderHook(() => useInstallPWA())

      expect(result.current.isInstallable).toBe(false)

      await act(async () => {
        const event = new Event('beforeinstallprompt') as any
        event.prompt = vi.fn()
        event.userChoice = Promise.resolve({ outcome: 'accepted' })
        window.dispatchEvent(event)
      })

      expect(result.current.isInstallable).toBe(true)
    })

    it('install returns false when no prompt', async () => {
      const { result } = renderHook(() => useInstallPWA())

      const installed = await result.current.install()

      expect(installed).toBe(false)
    })

    it('install returns true on accept', async () => {
      const { result } = renderHook(() => useInstallPWA())

      const mockPrompt = vi.fn().mockResolvedValue(undefined)

      await act(async () => {
        const event = new Event('beforeinstallprompt') as any
        event.prompt = mockPrompt
        event.userChoice = Promise.resolve({ outcome: 'accepted' })
        event.preventDefault = vi.fn()
        window.dispatchEvent(event)
      })

      let installed: boolean | undefined
      await act(async () => {
        installed = await result.current.install()
      })

      expect(installed).toBe(true)
      expect(mockPrompt).toHaveBeenCalled()
      expect(result.current.isInstalled).toBe(true)
    })

    it('install returns false on dismiss', async () => {
      const { result } = renderHook(() => useInstallPWA())

      const mockPrompt = vi.fn().mockResolvedValue(undefined)

      await act(async () => {
        const event = new Event('beforeinstallprompt') as any
        event.prompt = mockPrompt
        event.userChoice = Promise.resolve({ outcome: 'dismissed' })
        event.preventDefault = vi.fn()
        window.dispatchEvent(event)
      })

      let installed: boolean | undefined
      await act(async () => {
        installed = await result.current.install()
      })

      expect(installed).toBe(false)
    })

    it('handles install error', async () => {
      const { result } = renderHook(() => useInstallPWA())

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await act(async () => {
        const event = new Event('beforeinstallprompt') as any
        event.prompt = vi.fn().mockRejectedValue(new Error('Install error'))
        event.userChoice = Promise.resolve({ outcome: 'accepted' })
        event.preventDefault = vi.fn()
        window.dispatchEvent(event)
      })

      let installed: boolean | undefined
      await act(async () => {
        installed = await result.current.install()
      })

      expect(installed).toBe(false)
      expect(errorSpy).toHaveBeenCalled()

      errorSpy.mockRestore()
    })
  })

  describe('usePushNotifications', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'Notification', {
        value: { permission: 'default' },
        configurable: true,
      })
    })

    it('returns default permission initially', () => {
      const { result } = renderHook(() => usePushNotifications('test-vapid-key'))

      expect(result.current.permission).toBe('default')
      expect(result.current.subscription).toBeNull()
    })

    it('returns granted permission when already granted', () => {
      Object.defineProperty(window, 'Notification', {
        value: { permission: 'granted' },
        configurable: true,
      })

      const { result } = renderHook(() => usePushNotifications('test-vapid-key'))

      expect(result.current.permission).toBe('granted')
    })
  })
})
