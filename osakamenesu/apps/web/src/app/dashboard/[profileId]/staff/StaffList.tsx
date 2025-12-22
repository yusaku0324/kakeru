'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  type ShopManager,
  type ShopManagerRole,
  addShopManager,
  updateShopManager,
  deleteShopManager,
} from '@/lib/dashboard-managers'

type Props = {
  profileId: string
  initialManagers: ShopManager[]
}

const ROLE_LABELS: Record<ShopManagerRole, string> = {
  owner: 'オーナー',
  manager: 'マネージャー',
  staff: 'スタッフ',
}

const ROLE_DESCRIPTIONS: Record<ShopManagerRole, string> = {
  owner: 'スタッフの追加・削除、全ての管理権限',
  manager: '予約・シフト管理、プロフィール編集',
  staff: '予約確認、シフト閲覧のみ',
}

export function StaffList({ profileId, initialManagers }: Props) {
  const router = useRouter()
  const [managers, setManagers] = useState(initialManagers)
  const [isAdding, setIsAdding] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState<ShopManagerRole>('staff')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const result = await addShopManager(profileId, { email: newEmail, role: newRole })

    if (result.status === 'success') {
      setManagers((prev) => [
        ...prev,
        {
          id: result.data.id,
          user_id: result.data.user_id,
          email: result.data.email,
          display_name: result.data.display_name,
          role: result.data.role as ShopManagerRole,
          created_at: result.data.created_at,
        },
      ])
      setNewEmail('')
      setNewRole('staff')
      setIsAdding(false)
      router.refresh()
    } else if (result.status === 'conflict') {
      setError(result.message)
    } else if (result.status === 'forbidden') {
      setError('スタッフを追加する権限がありません（オーナーのみ可能）')
    } else {
      setError('スタッフの追加に失敗しました')
    }

    setIsSubmitting(false)
  }

  const handleRoleChange = async (managerId: string, newRoleValue: ShopManagerRole) => {
    setError(null)

    const result = await updateShopManager(profileId, managerId, { role: newRoleValue })

    if (result.status === 'success') {
      setManagers((prev) =>
        prev.map((m) => (m.id === managerId ? { ...m, role: newRoleValue } : m)),
      )
      router.refresh()
    } else if (result.status === 'forbidden') {
      setError('権限の変更にはオーナー権限が必要です')
    } else {
      setError('権限の変更に失敗しました')
    }
  }

  const handleDelete = async (managerId: string, email: string) => {
    if (!confirm(`${email} をスタッフから削除しますか？`)) {
      return
    }

    setError(null)

    const result = await deleteShopManager(profileId, managerId)

    if (result.status === 'success') {
      setManagers((prev) => prev.filter((m) => m.id !== managerId))
      router.refresh()
    } else if (result.status === 'cannot_remove_last_owner') {
      setError('最後のオーナーは削除できません')
    } else if (result.status === 'forbidden') {
      setError('削除にはオーナー権限が必要です')
    } else {
      setError('削除に失敗しました')
    }
  }

  const ownerCount = managers.filter((m) => m.role === 'owner').length

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="overflow-hidden rounded-lg border border-neutral-200">
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">
                メールアドレス
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">
                名前
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">
                権限
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-neutral-500">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 bg-white">
            {managers.map((manager) => (
              <tr key={manager.id}>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-900">
                  {manager.email}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-neutral-600">
                  {manager.display_name || '-'}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <select
                    value={manager.role}
                    onChange={(e) =>
                      handleRoleChange(manager.id, e.target.value as ShopManagerRole)
                    }
                    disabled={manager.role === 'owner' && ownerCount === 1}
                    className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    title={
                      manager.role === 'owner' && ownerCount === 1
                        ? '最後のオーナーの権限は変更できません'
                        : undefined
                    }
                  >
                    <option value="owner">{ROLE_LABELS.owner}</option>
                    <option value="manager">{ROLE_LABELS.manager}</option>
                    <option value="staff">{ROLE_LABELS.staff}</option>
                  </select>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <button
                    onClick={() => handleDelete(manager.id, manager.email)}
                    disabled={manager.role === 'owner' && ownerCount === 1}
                    className="text-sm text-red-600 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                    title={
                      manager.role === 'owner' && ownerCount === 1
                        ? '最後のオーナーは削除できません'
                        : undefined
                    }
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isAdding ? (
        <form onSubmit={handleAdd} className="space-y-4 rounded-lg border border-neutral-200 p-4">
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-neutral-700">
              メールアドレス
            </label>
            <input
              type="email"
              id="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
              placeholder="staff@example.com"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="role" className="block text-sm font-medium text-neutral-700">
              権限
            </label>
            <select
              id="role"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as ShopManagerRole)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
            >
              <option value="owner">{ROLE_LABELS.owner} - {ROLE_DESCRIPTIONS.owner}</option>
              <option value="manager">{ROLE_LABELS.manager} - {ROLE_DESCRIPTIONS.manager}</option>
              <option value="staff">{ROLE_LABELS.staff} - {ROLE_DESCRIPTIONS.staff}</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
            >
              {isSubmitting ? '追加中...' : '追加する'}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAdding(false)
                setNewEmail('')
                setNewRole('staff')
                setError(null)
              }}
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
            >
              キャンセル
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="inline-flex items-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700"
        >
          + スタッフを追加
        </button>
      )}

      <div className="rounded-lg bg-neutral-50 p-4">
        <h3 className="mb-2 text-sm font-medium text-neutral-900">権限について</h3>
        <ul className="space-y-1 text-sm text-neutral-600">
          <li>
            <strong>{ROLE_LABELS.owner}</strong>: {ROLE_DESCRIPTIONS.owner}
          </li>
          <li>
            <strong>{ROLE_LABELS.manager}</strong>: {ROLE_DESCRIPTIONS.manager}
          </li>
          <li>
            <strong>{ROLE_LABELS.staff}</strong>: {ROLE_DESCRIPTIONS.staff}
          </li>
        </ul>
      </div>
    </div>
  )
}
