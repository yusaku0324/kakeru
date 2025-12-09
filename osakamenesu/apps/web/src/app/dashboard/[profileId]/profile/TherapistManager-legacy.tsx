'use client'

import { ChangeEvent, DragEvent, FormEvent, useState } from 'react'
import SafeImage from '@/components/SafeImage'

export type TherapistPhotoFieldProps = {
  photoUrls: string[]
  disabled: boolean
  isUploading: boolean
  errorMessage: string | null
  onUpload: (files: FileList | null) => Promise<void>
  onRemove: (index: number) => void
  onMove: (index: number, direction: -1 | 1) => void
  onAddUrl: (url: string) => void
}

/**
 * @deprecated Use PhotoGrid component instead
 */
export function TherapistPhotoField({
  photoUrls,
  disabled,
  isUploading,
  errorMessage,
  onUpload,
  onRemove,
  onMove,
  onAddUrl,
}: TherapistPhotoFieldProps) {
  const [manualUrl, setManualUrl] = useState('')
  const [copyMessage, setCopyMessage] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files
    await onUpload(files)
    event.target.value = ''
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    if (!disabled && !isUploading) {
      setIsDragOver(true)
    }
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(false)
  }

  async function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(false)
    if (disabled || isUploading) return
    const files = event.dataTransfer.files
    if (files && files.length > 0) {
      await onUpload(files)
    }
  }

  async function handleCopy(url: string) {
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard) {
        setCopyMessage('クリップボードにアクセスできません')
        setTimeout(() => setCopyMessage(null), 2000)
        return
      }
      await navigator.clipboard.writeText(url)
      setCopyMessage('コピーしました')
      setTimeout(() => setCopyMessage(null), 1500)
    } catch {
      setCopyMessage('コピーに失敗しました')
      setTimeout(() => setCopyMessage(null), 2000)
    }
  }

  function handleManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = manualUrl.trim()
    if (!trimmed) return
    onAddUrl(trimmed)
    setManualUrl('')
  }

  return (
    <div className="space-y-3">
      <div
        className={`rounded-lg border-2 border-dashed p-4 transition ${
          isDragOver
            ? 'border-brand-primary bg-brand-primary/5'
            : 'border-neutral-200 bg-neutral-50'
        } ${disabled || isUploading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="text-3xl text-neutral-400">
            {isUploading ? '⏳' : '📷'}
          </div>
          <p className="text-sm text-neutral-600">
            {isUploading
              ? 'アップロード中…'
              : isDragOver
                ? 'ドロップしてアップロード'
                : '画像をドラッグ&ドロップ、またはクリックして選択'}
          </p>
          <label className="inline-flex">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={handleFileChange}
              multiple
              disabled={disabled || isUploading}
            />
            <span className="inline-flex cursor-pointer items-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60">
              ファイルを選択
            </span>
          </label>
          <p className="text-xs text-neutral-500">PNG / JPG / WEBP / GIF（最大 8MB）</p>
        </div>
      </div>
      {errorMessage ? <p className="text-xs text-red-600">{errorMessage}</p> : null}
      {photoUrls.length ? (
        <ul className="space-y-3">
          {photoUrls.map((url, index) => (
            <li
              key={`${url}-${index}`}
              className="flex flex-col gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3 sm:flex-row sm:items-center"
            >
              <div className="flex items-start gap-3 sm:w-1/2">
                <SafeImage
                  src={url}
                  alt={`セラピスト写真 ${index + 1}`}
                  width={80}
                  height={80}
                  className="h-20 w-20 flex-shrink-0 rounded-md object-cover"
                />
                <p className="flex-1 break-all text-xs text-neutral-600">{url}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={() => onMove(index, -1)}
                  disabled={disabled || index === 0}
                  className="rounded-md border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => onMove(index, 1)}
                  disabled={disabled || index === photoUrls.length - 1}
                  className="rounded-md border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy(url)}
                  className="rounded-md border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={disabled}
                >
                  コピー
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={disabled}
                >
                  削除
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 px-3 py-4 text-xs text-neutral-500">
          まだ写真が登録されていません。画像ファイルをアップロードするか、URL を追加してください。
        </p>
      )}
      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
        onSubmit={handleManualSubmit}
      >
        <input
          type="url"
          value={manualUrl}
          onChange={(event) => setManualUrl(event.target.value)}
          placeholder="https://example.com/photo.jpg"
          className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
          disabled={disabled}
        />
        <button
          type="submit"
          disabled={disabled || manualUrl.trim().length === 0}
          className="rounded-md border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          URL を追加
        </button>
      </form>
      {copyMessage ? <p className="text-xs text-neutral-500">{copyMessage}</p> : null}
    </div>
  )
}
