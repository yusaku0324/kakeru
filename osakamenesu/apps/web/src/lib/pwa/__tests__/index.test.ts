/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import {
  useInstallPWA,
  registerServiceWorker,
  unregisterServiceWorker,
  requestNotificationPermission,
  isStandalone,
  getDisplayMode,
  useOnlineStatus,
} from '../index'

describe('lib/pwa', () => {
  const originalWindow = global.window
  const originalNavigator = global.navigator

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    global.window = originalWindow
    Object.defineProperty(global, 'navigator', { value: originalNavigator, writable: true })
  })

  describe('isStandalone', () => {
    it('returns false when window is undefined', () => {
      const windowBackup = global.window
      Object.defineProperty(global, 'window', { value: undefined, configurable: true })
      expect(isStandalone()).toBe(false)
      Object.defineProperty(global, 'window', { value: windowBackup, configurable: true })
    })

    it('returns true when display-mode is standalone', () => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: query === '(display-mode: standalone)',
          media: query,
        })),
      })
      expect(isStandalone()).toBe(true)
    })

    it('returns true when navigator.standalone is true (iOS)', () => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(() => ({ matches: false })),
      })
      Object.defineProperty(window.navigator, 'standalone', {
        writable: true,
        configurable: true,
        value: true,
      })
      Object.defineProperty(document, 'referrer', {
        writable: true,
        configurable: true,
        value: '',
      })
      expect(isStandalone()).toBe(true)
    })

    it('returns true when referrer includes android-app://', () => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(() => ({ matches: false })),
      })
      Object.defineProperty(window.navigator, 'standalone', {
        writable: true,
        configurable: true,
        value: false,
      })
      Object.defineProperty(document, 'referrer', {
        writable: true,
        configurable: true,
        value: 'android-app://com.example.app',
      })
      expect(isStandalone()).toBe(true)
    })

    it('returns false when not standalone', () => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(() => ({ matches: false })),
      })
      Object.defineProperty(window.navigator, 'standalone', {
        writable: true,
        configurable: true,
        value: false,
      })
      Object.defineProperty(document, 'referrer', {
        writable: true,
        configurable: true,
        value: 'https://example.com',
      })
      expect(isStandalone()).toBe(false)
    })
  })

  describe('getDisplayMode', () => {
    it('returns browser when window is undefined', () => {
      const windowBackup = global.window
      Object.defineProperty(global, 'window', { value: undefined, configurable: true })
      expect(getDisplayMode()).toBe('browser')
      Object.defineProperty(global, 'window', { value: windowBackup, configurable: true })
    })

    it('returns fullscreen when in fullscreen mode', () => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: query === '(display-mode: fullscreen)',
        })),
      })
      expect(getDisplayMode()).toBe('fullscreen')
    })

    it('returns standalone when in standalone mode', () => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: query === '(display-mode: standalone)',
        })),
      })
      expect(getDisplayMode()).toBe('standalone')
    })

    it('returns minimal-ui when in minimal-ui mode', () => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: query === '(display-mode: minimal-ui)',
        })),
      })
      expect(getDisplayMode()).toBe('minimal-ui')
    })

    it('returns browser when no mode matches', () => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(() => ({ matches: false })),
      })
      expect(getDisplayMode()).toBe('browser')
    })
  })

  describe('registerServiceWorker', () => {
    it('returns null when window is undefined', async () => {
      const windowBackup = global.window
      Object.defineProperty(global, 'window', { value: undefined, configurable: true })
      const result = await registerServiceWorker()
      expect(result).toBeNull()
      Object.defineProperty(global, 'window', { value: windowBackup, configurable: true })
    })

    it('returns null when serviceWorker is not supported', async () => {
      Object.defineProperty(navigator, 'serviceWorker', {
        value: undefined,
        configurable: true,
      })
      const result = await registerServiceWorker()
      expect(result).toBeNull()
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
      expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/sw.js', { scope: '/' })
      consoleSpy.mockRestore()
    })

    it('returns null and logs error on failure', async () => {
      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          register: vi.fn().mockRejectedValue(new Error('Registration failed')),
        },
        configurable: true,
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const result = await registerServiceWorker()

      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('unregisterServiceWorker', () => {
    it('returns early when window is undefined', async () => {
      const windowBackup = global.window
      Object.defineProperty(global, 'window', { value: undefined, configurable: true })
      await expect(unregisterServiceWorker()).resolves.toBeUndefined()
      Object.defineProperty(global, 'window', { value: windowBackup, configurable: true })
    })

    it('returns early when serviceWorker is not supported', async () => {
      // Create a new navigator-like object without serviceWorker
      const navigatorWithoutSW = { ...navigator }
      delete (navigatorWithoutSW as any).serviceWorker
      Object.defineProperty(global, 'navigator', {
        value: navigatorWithoutSW,
        configurable: true,
      })
      await expect(unregisterServiceWorker()).resolves.toBeUndefined()
    })

    it('unregisters all service workers', async () => {
      const mockUnregister = vi.fn().mockResolvedValue(true)
      const mockRegistrations = [
        { unregister: mockUnregister },
        { unregister: mockUnregister },
      ]
      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          getRegistrations: vi.fn().mockResolvedValue(mockRegistrations),
        },
        configurable: true,
      })

      await unregisterServiceWorker()

      expect(mockUnregister).toHaveBeenCalledTimes(2)
    })
  })

  describe('requestNotificationPermission', () => {
    it('returns denied when Notification is not supported', async () => {
      const notificationBackup = (window as any).Notification
      delete (window as any).Notification

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const result = await requestNotificationPermission()

      expect(result).toBe('denied')
      expect(consoleSpy).toHaveBeenCalledWith('This browser does not support notifications')

      ;(window as any).Notification = notificationBackup
      consoleSpy.mockRestore()
    })

    it('returns granted when permission is already granted', async () => {
      Object.defineProperty(window, 'Notification', {
        value: { permission: 'granted' },
        configurable: true,
      })

      const result = await requestNotificationPermission()
      expect(result).toBe('granted')
    })

    it('returns denied when permission is already denied', async () => {
      Object.defineProperty(window, 'Notification', {
        value: { permission: 'denied' },
        configurable: true,
      })

      const result = await requestNotificationPermission()
      expect(result).toBe('denied')
    })

    it('requests permission when permission is default', async () => {
      Object.defineProperty(window, 'Notification', {
        value: {
          permission: 'default',
          requestPermission: vi.fn().mockResolvedValue('granted'),
        },
        configurable: true,
      })

      const result = await requestNotificationPermission()
      expect(result).toBe('granted')
      expect(window.Notification.requestPermission).toHaveBeenCalled()
    })
  })

  describe('useOnlineStatus', () => {
    it('returns true by default', () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })

      const { result } = renderHook(() => useOnlineStatus())
      expect(result.current).toBe(true)
    })

    it('returns false when offline', () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

      const { result } = renderHook(() => useOnlineStatus())
      expect(result.current).toBe(false)
    })

    it('updates when going offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })

      const { result } = renderHook(() => useOnlineStatus())
      expect(result.current).toBe(true)

      act(() => {
        window.dispatchEvent(new Event('offline'))
      })

      await waitFor(() => {
        expect(result.current).toBe(false)
      })
    })

    it('updates when going online', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

      const { result } = renderHook(() => useOnlineStatus())
      expect(result.current).toBe(false)

      act(() => {
        window.dispatchEvent(new Event('online'))
      })

      await waitFor(() => {
        expect(result.current).toBe(true)
      })
    })
  })

  describe('useInstallPWA', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(() => ({ matches: false })),
      })
    })

    it('initializes with default values', () => {
      const { result } = renderHook(() => useInstallPWA())

      expect(result.current.isInstalled).toBe(false)
      expect(result.current.isInstallable).toBe(false)
      expect(typeof result.current.install).toBe('function')
    })

    it('detects installed state via display-mode', () => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: query === '(display-mode: standalone)',
        })),
      })

      const { result } = renderHook(() => useInstallPWA())
      expect(result.current.isInstalled).toBe(true)
    })

    it('detects iOS device', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        configurable: true,
      })

      const { result } = renderHook(() => useInstallPWA())
      expect(result.current.isIOS).toBe(true)
    })

    it('install returns false when no prompt available', async () => {
      const { result } = renderHook(() => useInstallPWA())

      const installResult = await result.current.install()
      expect(installResult).toBe(false)
    })
  })
})
