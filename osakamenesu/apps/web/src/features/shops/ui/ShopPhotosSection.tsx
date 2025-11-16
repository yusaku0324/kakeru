type ShopPhotosSectionProps = {
  photos: string[]
  onUpdatePhoto: (index: number, value: string) => void
  onAddPhoto: () => void
  onRemovePhoto: (index: number) => void
}

export function ShopPhotosSection({ photos, onUpdatePhoto, onAddPhoto, onRemovePhoto }: ShopPhotosSectionProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700">掲載写真URL</label>
        <button onClick={onAddPhoto} className="rounded border px-3 py-1 text-sm" type="button">
          行を追加
        </button>
      </div>
      <div className="space-y-2">
        {photos.map((url, idx) => (
          <div key={`photo-${idx}`} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={url}
              onChange={e => onUpdatePhoto(idx, e.target.value)}
              className="flex-1 rounded border px-3 py-2 text-sm font-mono"
              placeholder="https://example.com/photo.jpg"
              data-testid="shop-photo-input"
            />
            <div className="flex gap-2">
              <button
                onClick={() => onRemovePhoto(idx)}
                className="text-xs text-red-600"
                type="button"
                disabled={photos.length <= 1}
              >
                削除
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">公開ページに表示する画像のURLを1行ずつ入力してください。</p>
    </section>
  )
}
