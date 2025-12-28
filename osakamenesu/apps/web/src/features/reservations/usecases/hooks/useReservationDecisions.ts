import { useCallback } from 'react'
import { useRouter } from 'next/navigation'

import {
  updateDashboardReservation,
  type DashboardReservationItem,
} from '@/lib/dashboard-reservations'
import { enqueueAsyncJob } from '@/lib/async-jobs'
import {
  RESERVATION_ERRORS,
  CONFLICT_ERRORS,
  NOTIFICATION_ERRORS,
  extractErrorMessage,
} from '@/lib/error-messages'

type ToastPush = (
  type: 'success' | 'error',
  message: string,
  options?: { ttl?: number; actionLabel?: string; onAction?: () => Promise<void> },
) => void

type UseReservationDecisionsOptions = {
  profileId: string
  push: ToastPush
  refresh: () => Promise<void>
  closeReservation: () => void
}

type DecisionType = 'approve' | 'decline' | 'cancel'

const STATUS_MAP: Record<DecisionType, DashboardReservationItem['status']> = {
  approve: 'confirmed',
  decline: 'declined',
  cancel: 'cancelled',
}

const LABEL_MAP: Record<DecisionType, string> = {
  approve: '承認',
  decline: '辞退',
  cancel: 'キャンセル',
}

/**
 * Handles reservation decision actions (approve, decline, cancel).
 * Manages status updates, conflict detection, and notification retry logic.
 */
export function useReservationDecisions({
  profileId,
  push,
  refresh,
  closeReservation,
}: UseReservationDecisionsOptions) {
  const router = useRouter()

  const decideReservation = useCallback(
    async (reservation: DashboardReservationItem, decision: DecisionType) => {
      const nextStatus = STATUS_MAP[decision]
      try {
        const { reservation: updated, conflict } = await updateDashboardReservation(
          profileId,
          reservation.id,
          { status: nextStatus },
        )
        push('success', `「${reservation.customer_name}」の予約を${LABEL_MAP[decision]}しました。`)

        if (conflict) {
          push('error', CONFLICT_ERRORS.RESERVATION_TIME_CONFLICT)
        }

        const asyncStatus = updated.async_job?.status
        if (asyncStatus === 'failed') {
          push('error', NOTIFICATION_ERRORS.REGISTER_FAILED, {
            ttl: 0,
            actionLabel: '再送信',
            onAction: async () => {
              if (!updated.async_job?.error) return
              try {
                await enqueueAsyncJob({
                  type: 'reservation_notification',
                  notification: {
                    reservation_id: updated.id,
                    shop_id: profileId,
                    shop_name: updated.customer_name,
                    customer_name: updated.customer_name,
                    customer_phone: updated.customer_phone,
                    desired_start: updated.desired_start,
                    desired_end: updated.desired_end,
                    status: updated.status,
                  },
                })
                push('success', '通知を再登録しました。')
              } catch {
                push('error', NOTIFICATION_ERRORS.REREGISTER_FAILED)
              }
            },
          })
        }

        closeReservation()
        await refresh()
        router.refresh()

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('reservation:updated', { detail: { shopId: profileId } }),
          )
        }
      } catch (error) {
        const message = extractErrorMessage(error, RESERVATION_ERRORS.UPDATE_FAILED)
        push('error', message)
      }
    },
    [closeReservation, profileId, push, refresh, router],
  )

  return { decideReservation }
}
