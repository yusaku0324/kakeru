'use client'

import { Bell, BellOff } from 'lucide-react'
import { usePushNotifications } from '@/hooks/use-push-notifications'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

export function PushNotificationSettings() {
  const {
    isSupported,
    isSubscribed,
    permission,
    loading,
    subscribe,
    unsubscribe,
    testNotification,
  } = usePushNotifications()

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5" />
            プッシュ通知
          </CardTitle>
          <CardDescription>
            お使いのブラウザはプッシュ通知をサポートしていません
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const handleToggle = async (checked: boolean) => {
    if (checked) {
      await subscribe()
    } else {
      await unsubscribe()
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          プッシュ通知
        </CardTitle>
        <CardDescription>
          予約確認やお知らせをプッシュ通知で受け取ることができます
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="push-notifications" className="flex-1">
            <div>プッシュ通知を有効にする</div>
            {permission === 'denied' && (
              <div className="text-sm text-muted-foreground mt-1">
                ブラウザの設定で通知がブロックされています
              </div>
            )}
          </Label>
          <Switch
            id="push-notifications"
            checked={isSubscribed}
            onCheckedChange={handleToggle}
            disabled={loading || permission === 'denied'}
          />
        </div>

        {isSubscribed && (
          <div className="space-y-2 pt-2">
            <p className="text-sm text-muted-foreground">
              通知を受け取れる内容:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 ml-4">
              <li>• 予約の確認・リマインダー</li>
              <li>• レビューへの返信</li>
              <li>• 重要なお知らせ</li>
            </ul>

            <Button
              variant="outline"
              size="sm"
              onClick={testNotification}
              disabled={loading}
              className="mt-4"
            >
              <Bell className="h-4 w-4 mr-2" />
              テスト通知を送信
            </Button>
          </div>
        )}

        {permission === 'denied' && (
          <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
            通知を有効にするには、ブラウザの設定から当サイトの通知を許可してください。
          </div>
        )}
      </CardContent>
    </Card>
  )
}