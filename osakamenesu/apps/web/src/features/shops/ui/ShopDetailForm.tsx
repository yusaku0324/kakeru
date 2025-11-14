import type { ContactInfo, ShopFormState } from '@/features/shops/model'

type ShopDetailFormProps = {
  form: ShopFormState
  serviceTypes: Array<'store' | 'dispatch'>
  tagDraft: string
  onChangeField: <K extends keyof ShopFormState>(key: K, value: ShopFormState[K]) => void
  onUpdateContact: (patch: Partial<ContactInfo>) => void
  onTagDraftChange: (value: string) => void
  onAddServiceTag: (value?: string) => void
  onRemoveServiceTag: (index: number) => void
}

export function ShopDetailForm({
  form,
  serviceTypes,
  tagDraft,
  onChangeField,
  onUpdateContact,
  onTagDraftChange,
  onAddServiceTag,
  onRemoveServiceTag,
}: ShopDetailFormProps) {
  const contact = form.contact || {}

  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-600">店舗名 *</label>
          <input
            value={form.name}
            onChange={e => onChangeField('name', e.target.value)}
            placeholder="例: アロマリゾート 難波本店"
            className="w-full rounded border border-slate-300 px-3 py-2 text-lg font-semibold text-slate-900"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-600">スラッグ *</label>
          <input
            value={form.slug}
            onChange={e => onChangeField('slug', e.target.value)}
            placeholder="例: aroma-namba"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-600">エリア</label>
          <input
            value={form.area}
            onChange={e => onChangeField('area', e.target.value)}
            placeholder="例: 難波/日本橋"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-600">最低価格</label>
          <input
            type="number"
            min={0}
            value={form.priceMin}
            onChange={e => onChangeField('priceMin', Number(e.target.value))}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-600">最高価格</label>
          <input
            type="number"
            min={0}
            value={form.priceMax}
            onChange={e => onChangeField('priceMax', Number(e.target.value))}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-600">サービス種別</label>
          <select
            value={form.serviceType}
            onChange={e => onChangeField('serviceType', e.target.value as ShopFormState['serviceType'])}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            {serviceTypes.map(type => (
              <option key={type} value={type}>
                {type === 'store' ? '店舗型' : '出張型'}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">店舗紹介文</label>
          <textarea
            value={form.description}
            onChange={e => onChangeField('description', e.target.value)}
            rows={4}
            className="w-full rounded border px-3 py-2 text-sm"
            data-testid="shop-description"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">キャッチコピー</label>
          <textarea
            value={form.catchCopy}
            onChange={e => onChangeField('catchCopy', e.target.value)}
            rows={4}
            className="w-full rounded border px-3 py-2 text-sm"
            data-testid="shop-catch-copy"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">住所</label>
        <input
          value={form.address}
          onChange={e => onChangeField('address', e.target.value)}
          className="w-full rounded border px-3 py-2 text-sm"
          data-testid="shop-address"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">サービスタグ</label>
        <div className="flex flex-wrap gap-2" data-testid="shop-service-tags">
          {form.serviceTags.length === 0 ? (
            <span className="rounded border border-dashed px-2 py-1 text-xs text-slate-400">タグ未設定</span>
          ) : (
            form.serviceTags.map((tag, idx) => (
              <span
                key={`${tag}-${idx}`}
                className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => onRemoveServiceTag(idx)}
                  className="hover:text-blue-900"
                  aria-label={`${tag} を削除`}
                >
                  ×
                </button>
              </span>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <input
            value={tagDraft}
            onChange={e => onTagDraftChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onAddServiceTag(tagDraft)
              }
            }}
            className="flex-1 rounded border px-3 py-2 text-sm"
            placeholder="例: 指圧, アロマ"
            data-testid="shop-service-tag-input"
          />
          <button
            type="button"
            onClick={() => onAddServiceTag(tagDraft)}
            className="rounded border px-3 py-1 text-sm"
            data-testid="shop-service-tag-add"
          >
            追加
          </button>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">連絡先</h2>
        <div className="grid gap-2 md:grid-cols-2">
          <input
            value={contact.phone || ''}
            onChange={e => onUpdateContact({ phone: e.target.value })}
            className="rounded border px-3 py-2 text-sm"
            placeholder="電話番号"
          />
          <input
            value={contact.line_id || ''}
            onChange={e => onUpdateContact({ line_id: e.target.value })}
            className="rounded border px-3 py-2 text-sm"
            placeholder="LINE ID / URL"
          />
          <input
            value={contact.website_url || ''}
            onChange={e => onUpdateContact({ website_url: e.target.value })}
            className="rounded border px-3 py-2 text-sm"
            placeholder="公式サイトURL"
          />
          <input
            value={contact.reservation_form_url || ''}
            onChange={e => onUpdateContact({ reservation_form_url: e.target.value })}
            className="rounded border px-3 py-2 text-sm"
            placeholder="WEB予約フォームURL"
          />
        </div>
      </section>
    </section>
  )
}
