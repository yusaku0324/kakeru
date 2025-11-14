"use client"

import { ToastContainer, useToast } from '@/components/useToast'
import { ShopDetailForm } from '@/features/shops/ui/ShopDetailForm'
import { ShopList } from '@/features/shops/ui/ShopList'
import { ShopMenusSection } from '@/features/shops/ui/ShopMenusSection'
import { ShopPhotosSection } from '@/features/shops/ui/ShopPhotosSection'
import { ShopReservationSummary } from '@/features/shops/ui/ShopReservationSummary'
import { ShopStaffSection } from '@/features/shops/ui/ShopStaffSection'
import { useAdminShopsController } from '@/features/shops/usecases/useAdminShopsController'

export default function AdminShopsPage() {
  const { toasts, push, remove } = useToast()
  const { state, actions } = useAdminShopsController({
    onError: message => push('error', message),
    onSuccess: message => push('success', message),
  })

  const { shops, selectedId, isCreating, detail, form, availability, loadingDetail, serviceTypes, tagDraft, canSave } = state
  const {
    selectShop,
    startCreate,
    updateForm,
    updateMenu,
    addMenu,
    removeMenu,
    updateStaff,
    addStaff,
    removeStaff,
    updatePhoto,
    addPhoto,
    removePhoto,
    saveContent,
    addAvailabilityDay,
    updateAvailabilityDate,
    addSlot,
    updateSlot,
    removeSlot,
    saveAvailability,
    deleteAvailabilityDay,
    updateContact,
    addServiceTag,
    removeServiceTag,
    setTagDraft: setTagDraftValue,
  } = actions

  if (!detail || (!selectedId && !isCreating)) {
    return (
      <main className="mx-auto max-w-5xl space-y-4 p-4">
        <h1 data-testid="admin-title" className="text-2xl font-semibold">
          店舗管理
        </h1>
        <p className="text-sm text-slate-500">店舗を選択してください。</p>
        <ToastContainer toasts={toasts} onDismiss={remove} />
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4">
      <h1 data-testid="admin-title" className="text-2xl font-semibold">
        店舗管理
      </h1>
      <div className="flex flex-wrap items-start gap-4">
        <ShopList shops={shops} selectedId={selectedId} isCreating={isCreating} onSelectShop={selectShop} onCreateShop={startCreate} />

        <section className="flex-1 space-y-6">
          <ShopDetailForm
            form={form}
            serviceTypes={serviceTypes}
            tagDraft={tagDraft}
            onChangeField={updateForm}
            onUpdateContact={updateContact}
            onTagDraftChange={setTagDraftValue}
            onAddServiceTag={addServiceTag}
            onRemoveServiceTag={removeServiceTag}
          />

          <ShopPhotosSection photos={form.photos} onUpdatePhoto={updatePhoto} onAddPhoto={addPhoto} onRemovePhoto={removePhoto} />

          <ShopMenusSection menus={form.menus} onUpdateMenu={updateMenu} onAddMenu={addMenu} onRemoveMenu={removeMenu} />

          <ShopStaffSection staff={form.staff} onUpdateStaff={updateStaff} onAddStaff={addStaff} onRemoveStaff={removeStaff} />

          <button
            onClick={saveContent}
            className="rounded bg-blue-600 px-4 py-2 text-white shadow disabled:opacity-50"
            disabled={loadingDetail || !canSave}
          >
            店舗情報を保存
          </button>

          <ShopReservationSummary
            availability={availability}
            onAddDay={addAvailabilityDay}
            onDeleteDay={deleteAvailabilityDay}
            onUpdateDate={updateAvailabilityDate}
            onAddSlot={addSlot}
            onUpdateSlot={updateSlot}
            onRemoveSlot={removeSlot}
            onSaveDay={saveAvailability}
          />
        </section>
      </div>

      <ToastContainer toasts={toasts} onDismiss={remove} />
    </main>
  )
}
