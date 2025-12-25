import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth/hooks'
import { toast } from '@/components/ui/use-toast'
import {
  isPushNotificationSupported,
  requestNotificationPermission,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  getCurrentSubscription,
  sendTestNotification,
} from '@/lib/pwa/push-notifications'

interface UsePushNotificationsResult {
  isSupported: boolean
  isSubscribed: boolean
  permission: NotificationPermission | null
  loading: boolean
  error: Error | null
  subscribe: () => Promise<void>
  unsubscribe: () => Promise<void>
  testNotification: () => Promise<void>
}

export function usePushNotifications(): UsePushNotificationsResult {
  const { user } = useAuth()
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const isSupported = isPushNotificationSupported()

  // 現在の購読状態を確認
  const checkSubscriptionStatus = useCallback(async () => {
    if (!isSupported || !user) {
      setLoading(false)
      return
    }

    try {
      // 通知権限の状態を確認
      if ('Notification' in window) {
        setPermission(Notification.permission)
      }

      // 購読状態を確認
      const subscription = await getCurrentSubscription()
      setIsSubscribed(!!subscription)
    } catch (err) {
      console.error('購読状態の確認に失敗:', err)
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [isSupported, user])

  useEffect(() => {
    checkSubscriptionStatus()
  }, [checkSubscriptionStatus])

  // プッシュ通知を購読
  const subscribe = useCallback(async () => {
    if (!isSupported || !user) {
      toast({
        title: 'プッシュ通知を有効にできません',
        description: 'ログインが必要です',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    setError(null)

    try {
      // 通知権限を要求
      const perm = await requestNotificationPermission()
      setPermission(perm)

      if (perm !== 'granted') {
        return
      }

      // プッシュ通知を購読
      const subscription = await subscribeToPushNotifications()

      if (subscription) {
        // サーバーに購読情報を送信
        const response = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            keys: {
              p256dh: arrayBufferToBase64(subscription.getKey('p256dh')!),
              auth: arrayBufferToBase64(subscription.getKey('auth')!),
            },
          }),
        })

        if (!response.ok) {
          throw new Error('サーバーへの登録に失敗しました')
        }

        setIsSubscribed(true)
        toast({
          title: 'プッシュ通知を有効にしました',
          description: '重要なお知らせを通知でお届けします',
        })
      }
    } catch (err) {
      console.error('プッシュ通知の購読に失敗:', err)
      setError(err as Error)
      toast({
        title: 'エラー',
        description: 'プッシュ通知の有効化に失敗しました',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [isSupported, user])

  // プッシュ通知を購読解除
  const unsubscribe = useCallback(async () => {
    if (!isSupported || !user) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const subscription = await getCurrentSubscription()

      if (subscription) {
        // サーバーから購読情報を削除
        const response = await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
          }),
        })

        if (!response.ok) {
          throw new Error('サーバーからの削除に失敗しました')
        }
      }

      // ブラウザから購読を解除
      const success = await unsubscribeFromPushNotifications()

      if (success) {
        setIsSubscribed(false)
        toast({
          title: 'プッシュ通知を無効にしました',
          description: '通知が不要な場合はいつでも再度有効にできます',
        })
      }
    } catch (err) {
      console.error('プッシュ通知の購読解除に失敗:', err)
      setError(err as Error)
      toast({
        title: 'エラー',
        description: 'プッシュ通知の無効化に失敗しました',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [isSupported, user])

  // テスト通知を送信
  const testNotification = useCallback(async () => {
    if (!isSupported || !isSubscribed) {
      toast({
        title: 'テスト通知を送信できません',
        description: 'プッシュ通知が有効になっていません',
        variant: 'destructive',
      })
      return
    }

    try {
      // ローカルテスト通知
      await sendTestNotification()

      // サーバー経由でテスト通知
      const response = await fetch('/api/push/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'テスト通知',
          body: 'プッシュ通知が正常に動作しています！',
        }),
      })

      if (!response.ok) {
        throw new Error('テスト通知の送信に失敗しました')
      }

      toast({
        title: 'テスト通知を送信しました',
        description: '通知が表示されることを確認してください',
      })
    } catch (err) {
      console.error('テスト通知の送信に失敗:', err)
      setError(err as Error)
      toast({
        title: 'エラー',
        description: 'テスト通知の送信に失敗しました',
        variant: 'destructive',
      })
    }
  }, [isSupported, isSubscribed])

  return {
    isSupported,
    isSubscribed,
    permission,
    loading,
    error,
    subscribe,
    unsubscribe,
    testNotification,
  }
}

// ArrayBufferをBase64文字列に変換
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''

  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }

  return window.btoa(binary)
}