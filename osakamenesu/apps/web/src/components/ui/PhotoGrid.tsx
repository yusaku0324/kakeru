'use client'

import { ChangeEvent, DragEvent, KeyboardEvent, useState, useCallback } from 'react'
import clsx from 'clsx'
import SafeImage from '@/components/SafeImage'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

export type PhotoGridProps = {
  photos: string[]
  onChange: (photos: string[]) => void
  onUpload: (files: FileList) => Promise<void>
  disabled?: boolean
  isUploading?: boolean
  error?: string | null
  maxPhotos?: number
}

export function PhotoGrid({
  photos,
  onChange,
  onUpload,
  disabled = false,
  isUploading = false,
  error = null,
  maxPhotos = 10,
}: PhotoGridProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null)

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(false)
    if (disabled || isUploading) return
    const files = event.dataTransfer.files
    if (files && files.length > 0) {
      await onUpload(files)
    }
  }, [disabled, isUploading, onUpload])

  const handleFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files && files.length > 0) {
      await onUpload(files)
    }
    event.target.value = ''
  }, [onUpload])

  const handleRemove = useCallback((index: number) => {
    onChange(photos.filter((_, i) => i !== index))
    setDeleteConfirmIndex(null)
  }, [photos, onChange])

  const handleDeleteClick = useCallback((index: number) => {
    setDeleteConfirmIndex(index)
  }, [])

  const handleSetMain = useCallback((index: number) => {
    if (index === 0) return
    const newPhotos = [...photos]
    const [moved] = newPhotos.splice(index, 1)
    newPhotos.unshift(moved)
    onChange(newPhotos)
  }, [photos, onChange])

  // Photo reorder via drag
  const handlePhotoDragStart = useCallback((index: number) => {
    setDraggedIndex(index)
  }, [])

  const handlePhotoDragOver = useCallback((index: number) => {
    if (draggedIndex === null || draggedIndex === index) return
    setDragOverIndex(index)
  }, [draggedIndex])

  const handlePhotoDragEnd = useCallback(() => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      const newPhotos = [...photos]
      const [moved] = newPhotos.splice(draggedIndex, 1)
      newPhotos.splice(dragOverIndex, 0, moved)
      onChange(newPhotos)
    }
    setDraggedIndex(null)
    setDragOverIndex(null)
  }, [draggedIndex, dragOverIndex, photos, onChange])

  // Keyboard navigation for reordering photos
  const handlePhotoKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>, index: number) => {
    if (disabled) return

    const movePhoto = (fromIndex: number, toIndex: number) => {
      if (toIndex < 0 || toIndex >= photos.length) return
      const newPhotos = [...photos]
      const [moved] = newPhotos.splice(fromIndex, 1)
      newPhotos.splice(toIndex, 0, moved)
      onChange(newPhotos)
    }

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault()
        movePhoto(index, index - 1)
        break
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault()
        movePhoto(index, index + 1)
        break
      case 'Home':
        event.preventDefault()
        movePhoto(index, 0)
        break
      case 'End':
        event.preventDefault()
        movePhoto(index, photos.length - 1)
        break
      case 'Delete':
      case 'Backspace':
        event.preventDefault()
        handleDeleteClick(index)
        break
    }
  }, [disabled, photos, onChange, handleDeleteClick])

  return (
    <div className="space-y-4">
      {/* Photo grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((url, index) => (
            <div
              key={`${url}-${index}`}
              role="button"
              tabIndex={disabled ? -1 : 0}
              aria-label={`写真${index + 1}${index === 0 ? '（メイン）' : ''}。矢印キーで並べ替え、Deleteで削除`}
              draggable={!disabled}
              onDragStart={() => handlePhotoDragStart(index)}
              onDragOver={(e) => {
                e.preventDefault()
                handlePhotoDragOver(index)
              }}
              onDragEnd={handlePhotoDragEnd}
              onKeyDown={(e) => handlePhotoKeyDown(e, index)}
              className={clsx(
                'group relative aspect-square cursor-grab overflow-hidden rounded-xl border-2 transition-all active:cursor-grabbing',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary',
                dragOverIndex === index && 'border-brand-primary scale-105',
                draggedIndex === index ? 'opacity-50' : 'border-transparent',
                index === 0 ? 'ring-2 ring-brand-primary ring-offset-2' : ''
              )}
            >
              <SafeImage
                src={url}
                alt={`写真 ${index + 1}`}
                fill
                className="object-cover"
              />
              {/* Main photo badge */}
              {index === 0 && (
                <div className="absolute left-2 top-2 rounded-full bg-brand-primary px-2 py-0.5 text-[10px] font-bold text-white shadow-md">
                  メイン
                </div>
              )}
              {/* Overlay with actions */}
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                {index !== 0 && !disabled && (
                  <button
                    type="button"
                    onClick={() => handleSetMain(index)}
                    aria-label={`写真${index + 1}をメインに設定`}
                    className="rounded-lg bg-white/90 px-2 py-1 text-xs font-medium text-neutral-700 shadow transition hover:bg-white"
                  >
                    メインに
                  </button>
                )}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(index)}
                    aria-label={`写真${index + 1}を削除`}
                    className="rounded-lg bg-red-500/90 px-2 py-1 text-xs font-medium text-white shadow transition hover:bg-red-500"
                  >
                    削除
                  </button>
                )}
              </div>
              {/* Order badge */}
              <div className="absolute bottom-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs font-bold text-white">
                {index + 1}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload zone */}
      {photos.length < maxPhotos && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={clsx(
            'relative overflow-hidden rounded-2xl border-2 border-dashed p-8 transition-all',
            isDragOver
              ? 'border-brand-primary bg-brand-primary/5 scale-[1.02]'
              : 'border-neutral-300 bg-neutral-50 hover:border-neutral-400',
            disabled || isUploading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
          )}
        >
          <div className="flex flex-col items-center gap-4 text-center">
            {/* Icon */}
            <div className={clsx(
              'flex h-16 w-16 items-center justify-center rounded-2xl transition-all',
              isDragOver
                ? 'bg-brand-primary/20 text-brand-primary'
                : 'bg-neutral-200 text-neutral-500'
            )}>
              {isUploading ? (
                <svg className="h-8 w-8 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
            </div>

            {/* Text */}
            <div>
              <p className="text-base font-medium text-neutral-700">
                {isUploading
                  ? 'アップロード中...'
                  : isDragOver
                    ? 'ドロップしてアップロード'
                    : '写真をドラッグ&ドロップ'}
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                または クリックして選択
              </p>
            </div>

            {/* Button */}
            <label className={clsx(
              'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all',
              'bg-gradient-to-r from-brand-primary to-brand-secondary text-white shadow-lg shadow-brand-primary/25',
              'hover:shadow-xl hover:shadow-brand-primary/30 hover:-translate-y-0.5',
              disabled || isUploading ? 'pointer-events-none opacity-60' : 'cursor-pointer'
            )}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>写真を選択</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={handleFileChange}
                multiple
                disabled={disabled || isUploading}
              />
            </label>

            {/* Format hint */}
            <p className="text-xs text-neutral-400">
              PNG / JPG / WEBP / GIF（最大 8MB）
            </p>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Photo count and keyboard hint */}
      <div className="space-y-1">
        <p className="text-xs text-neutral-500">
          {photos.length} / {maxPhotos} 枚の写真がアップロードされています
        </p>
        {photos.length > 1 && !disabled && (
          <p className="text-xs text-neutral-400">
            ヒント: 写真を選択して矢印キーで並べ替えできます
          </p>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleteConfirmIndex !== null}
        title="写真を削除"
        message={`写真${deleteConfirmIndex !== null ? deleteConfirmIndex + 1 : ''}を削除しますか？この操作は取り消せません。`}
        confirmLabel="削除する"
        cancelLabel="キャンセル"
        variant="danger"
        onConfirm={() => deleteConfirmIndex !== null && handleRemove(deleteConfirmIndex)}
        onCancel={() => setDeleteConfirmIndex(null)}
      />
    </div>
  )
}

export default PhotoGrid
