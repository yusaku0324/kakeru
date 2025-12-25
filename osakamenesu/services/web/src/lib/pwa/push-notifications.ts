/**
 * Push notification utilities for PWA
 */

import { toast } from '@/components/ui/use-toast'

// VAPID公開鍵を環境変数から取得
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

/**
 * ブラウザがプッシュ通知をサポートしているかチェック
 */
export function isPushNotificationSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/**
 * 通知の権限を取得
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isPushNotificationSupported()) {
    throw new Error('プッシュ通知はサポートされていません')
  }

  const permission = await Notification.requestPermission()

  if (permission === 'denied') {
    toast({
      title: '通知がブロックされています',
      description: 'ブラウザの設定から通知を許可してください',
      variant: 'destructive',
    })
  }

  return permission
}

/**
 * プッシュ通知の購読を作成
 */
export async function subscribeToPushNotifications(): Promise<PushSubscription | null> {
  if (!isPushNotificationSupported()) {
    throw new Error('プッシュ通知はサポートされていません')
  }

  if (!VAPID_PUBLIC_KEY) {
    console.error('VAPID公開鍵が設定されていません')
    return null
  }

  try {
    // Service Workerの登録を待つ
    const registration = await navigator.serviceWorker.ready

    // 既存の購読をチェック
    const existingSubscription = await registration.pushManager.getSubscription()
    if (existingSubscription) {
      return existingSubscription
    }

    // 新しい購読を作成
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })

    return subscription
  } catch (error) {
    console.error('プッシュ通知の購読に失敗:', error)
    toast({
      title: 'プッシュ通知の登録に失敗しました',
      description: '時間をおいて再度お試しください',
      variant: 'destructive',
    })
    return null
  }
}

/**
 * プッシュ通知の購読を解除
 */
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  if (!isPushNotificationSupported()) {
    return false
  }

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()

    if (subscription) {
      const success = await subscription.unsubscribe()
      return success
    }

    return true
  } catch (error) {
    console.error('プッシュ通知の購読解除に失敗:', error)
    return false
  }
}

/**
 * 現在の購読状態を取得
 */
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushNotificationSupported()) {
    return null
  }

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    return subscription
  } catch (error) {
    console.error('購読状態の取得に失敗:', error)
    return null
  }
}

/**
 * Base64 URL文字列をUint8Arrayに変換
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}

/**
 * テスト通知を送信
 */
export async function sendTestNotification(): Promise<void> {
  if (!('Notification' in window)) {
    throw new Error('このブラウザは通知をサポートしていません')
  }

  if (Notification.permission !== 'granted') {
    throw new Error('通知の権限が許可されていません')
  }

  // ローカルテスト通知
  const notification = new Notification('テスト通知', {
    body: 'これはテスト通知です。正常に動作しています！',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: 'test-notification',
    renotify: true,
  })

  notification.onclick = () => {
    notification.close()
    window.focus()
  }
}