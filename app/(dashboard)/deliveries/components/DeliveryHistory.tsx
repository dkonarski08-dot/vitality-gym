'use client'
// Tab 2 — История
import { PRODUCT_CATEGORIES } from '@/src/constants/categories'
import { UNITS } from '@/src/types/deliveries'
import { MONTHS_BG } from '@/lib/formatters'
import type { DeliveriesHookReturn } from '../hooks/useDeliveries'

interface DeliveryHistoryProps {
  hook: DeliveriesHookReturn
}

function dateShort(d: string | null): string {
  if (!d) return '—'
  const dt = new Date(d + 'T12:00:00')
  return `${dt.getDate()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${dt.getFullYear()}`
}

export default function DeliveryHistory({ hook }: DeliveryHistoryProps) {
  const {
    userRole,
    filteredDeliveries, sortedMonths,
    historyMonth, selectedId, confirmDelete,
    editForm, isEditModalOpen, editSaving,
    actionLoading, copiedLink,
    setHistoryMonth, setSelectedId, setConfirmDelete,
    handleDelete, handleApprove, handleReject,
    openEditModal, closeEditModal,
    updateEditField, updateEditItem, removeEditItem, addEditItem,
    handleEditSave, exportCSV, copyLink, copyMonthLinks,
  } = hook

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-5">
        <select
          value={historyMonth}
          onChange={e => setHistoryMonth(e.target.value)}
          className="bg-white/5 border border-white/15 rounded-xl px-4 py-2 text-sm text-white focus:outline-none"
        >
          <option value="">Всички</option>
          {sortedMonths.map(m => {
            const [y, mo] = m.split('-')
            return <option key={m} value={m}>{MONTHS_BG[parseInt(mo) - 1]} {y}</option>
          })}
        </select>
        <span className="text-xs text-white/40">{filteredDeliveries.length} доставки</span>
        {filteredDeliveries.some(d => d.photo_url) && (
          <button
            onClick={copyMonthLinks}
            className="px-3 py-1.5 rounded-lg text-[10px] font-medium bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"
          >
            {copiedLink === 'all' ? '✓ Копирани!' : '📋 Линкове'}
          </button>
        )}
        <button
          onClick={exportCSV}
          className="ml-auto px-3 py-1.5 rounded-lg text-[10px] font-medium bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"
        >
          📥 Експорт CSV
        </button>
      </div>

      {/* Delivery list */}
      {filteredDeliveries.length === 0 ? (
        <div className="text-center py-20 text-white/40">Няма доставки</div>
      ) : (
        <div className="space-y-3">
          {filteredDeliveries.map(d => (
            <div key={d.id} className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
              {/* Header row — click to expand */}
              <div onClick={() => setSelectedId(selectedId === d.id ? null : d.id)} className="cursor-pointer">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-semibold text-white">{d.supplier_name}</div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${d.status === 'approved' ? 'bg-emerald-500/15 text-emerald-400' : d.status === 'rejected' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'}`}>
                      {d.status === 'approved' ? 'Одобрена' : d.status === 'rejected' ? 'Отхвърлена' : 'Чака'}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-white">{d.total_amount?.toFixed(2) ?? '—'}€</div>
                </div>
                <div className="flex gap-4 text-xs text-white/50">
                  {d.invoice_number && <span>№ {d.invoice_number}</span>}
                  <span>{dateShort(d.invoice_date)}</span>
                  <span>{d.delivery_items?.length || 0} продукта</span>
                </div>
              </div>

              {/* Expanded detail */}
              {selectedId === d.id && (
                <div className="mt-4 pt-4 border-t border-white/[0.06]">
                  {/* Photos */}
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {d.photo_url && (
                      <div className="relative">
                        <img src={d.photo_url} alt="" className="max-h-[200px] object-contain rounded-lg border border-white/10" />
                        <button
                          onClick={() => copyLink(d.photo_url!)}
                          className="absolute bottom-1 right-1 px-2 py-1 rounded bg-black/70 text-[9px] text-white/80 hover:text-white"
                        >
                          {copiedLink === d.photo_url ? '✓' : '📋 Линк'}
                        </button>
                      </div>
                    )}
                    {d.extra_photos?.map((url, i) => (
                      <div key={i} className="relative">
                        <img src={url} alt="" className="max-h-[200px] object-contain rounded-lg border border-white/10" />
                        <button onClick={() => copyLink(url)} className="absolute bottom-1 right-1 px-2 py-1 rounded bg-black/70 text-[9px] text-white/80">
                          {copiedLink === url ? '✓' : '📋'}
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Items */}
                  {(d.delivery_items?.length ?? 0) > 0 && (
                    <div className="mb-3">
                      {d.delivery_items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-xs py-2 border-b border-white/[0.04] last:border-0">
                          <div className="flex items-center gap-2">
                            <span className="text-white/80">{item.product_name}</span>
                            {item.category && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/30">{item.category}</span>}
                          </div>
                          <div className="flex gap-4 text-white/50">
                            <span>{item.quantity} {item.unit}</span>
                            {item.unit_price != null && <span>{item.unit_price.toFixed(2)}€</span>}
                            {item.expiry_date && <span className="text-white/40">До: {dateShort(item.expiry_date)}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Admin actions — Fix 1 + Fix 6 */}
                  {userRole === 'admin' && (
                    <div className="flex gap-2 flex-wrap">
                      {d.status === 'pending' && <>
                        <button
                          onClick={() => handleApprove(d.id)}
                          disabled={actionLoading === d.id}
                          className="px-4 py-2 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 disabled:opacity-40"
                        >
                          {actionLoading === d.id ? '...' : '✓ Одобри'}
                        </button>
                        <button
                          onClick={() => handleReject(d.id)}
                          disabled={actionLoading === d.id}
                          className="px-4 py-2 rounded-lg text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25 disabled:opacity-40"
                        >
                          {actionLoading === d.id ? '...' : '✕ Отхвърли'}
                        </button>
                      </>}
                      <button
                        onClick={() => openEditModal(d)}
                        className="px-4 py-2 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400/70 border border-amber-500/15 hover:text-amber-400"
                      >
                        ✏️ Редактирай
                      </button>
                      <button
                        onClick={() => setConfirmDelete(d.id)}
                        className="px-4 py-2 rounded-lg text-xs font-medium bg-red-500/10 text-red-400/60 border border-red-500/15 hover:text-red-400 ml-auto"
                      >
                        🗑 Изтрий
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDelete(null)}>
          <div className="bg-[#0f0f14] border border-white/[0.1] rounded-2xl p-6 w-80 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="text-sm font-semibold text-white mb-2">Изтриване на доставка</div>
            <div className="text-xs text-white/50 mb-5">Сигурен ли си? Това действие е необратимо.</div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 rounded-xl text-xs font-medium bg-white/5 text-white/60 border border-white/10 hover:bg-white/10">Откажи</button>
              <button onClick={() => handleDelete(confirmDelete)} className="flex-1 py-2.5 rounded-xl text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30">🗑 Изтрий</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal — Fix 2 (consolidated editForm) */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-6" onClick={closeEditModal}>
          <div className="bg-[#0f0f14] border border-white/[0.1] rounded-2xl p-6 w-full max-w-2xl shadow-2xl mx-4" onClick={e => e.stopPropagation()}>
            <div className="text-sm font-semibold text-white mb-5">Редактирай доставка</div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div>
                <label className="text-xs text-white/70 block mb-1">Доставчик</label>
                <input value={editForm.supplier} onChange={e => updateEditField('supplier', e.target.value)} className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white focus:border-amber-400/50 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-white/70 block mb-1">Номер</label>
                <input value={editForm.invoiceNumber} onChange={e => updateEditField('invoiceNumber', e.target.value)} className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white focus:border-amber-400/50 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-white/70 block mb-1">Дата</label>
                <input type="date" value={editForm.invoiceDate} onChange={e => updateEditField('invoiceDate', e.target.value)} className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white focus:border-amber-400/50 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-white/70 block mb-1">Падеж</label>
                <input type="date" value={editForm.paymentDueDate} onChange={e => updateEditField('paymentDueDate', e.target.value)} className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white focus:border-amber-400/50 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-white/70 block mb-1">Плащане</label>
                <select value={editForm.paymentMethod} onChange={e => updateEditField('paymentMethod', e.target.value)} className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none">
                  <option value="">—</option>
                  <option value="cash">В брой</option>
                  <option value="bank_transfer">Банков път</option>
                  <option value="card">Карта</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-white/70 block mb-1">Сума с ДДС (€)</label>
                <input type="number" step="0.01" value={editForm.totalAmount} onChange={e => updateEditField('totalAmount', e.target.value)} className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-sm font-bold text-white focus:border-amber-400/50 focus:outline-none" />
              </div>
            </div>

            <div className="text-xs text-white/60 mb-2">Продукти</div>
            <div className="space-y-2 mb-3 max-h-[300px] overflow-y-auto">
              {editForm.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white/[0.02] border border-white/[0.06] rounded-lg p-2">
                  <input value={item.product_name} onChange={e => updateEditItem(idx, 'product_name', e.target.value)} className="col-span-3 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none" />
                  <input type="number" step="0.01" value={item.quantity} onChange={e => updateEditItem(idx, 'quantity', parseFloat(e.target.value) || 0)} className="col-span-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white text-center focus:outline-none" />
                  <select value={item.unit} onChange={e => updateEditItem(idx, 'unit', e.target.value)} className="col-span-1 bg-white/5 border border-white/10 rounded-lg px-1 py-1.5 text-xs text-white focus:outline-none">
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <input type="number" step="0.01" value={item.unit_price ?? ''} onChange={e => updateEditItem(idx, 'unit_price', e.target.value ? parseFloat(e.target.value) : null)} placeholder="Цена" className="col-span-2 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white text-right focus:outline-none" />
                  <select value={item.category} onChange={e => updateEditItem(idx, 'category', e.target.value)} className="col-span-2 bg-white/5 border border-white/10 rounded-lg px-1 py-1.5 text-xs text-white focus:outline-none">
                    {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input type="date" value={item.expiry_date ?? ''} onChange={e => updateEditItem(idx, 'expiry_date', e.target.value || null)} className="col-span-2 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none" />
                  <button onClick={() => removeEditItem(idx)} className="col-span-1 text-red-400/40 hover:text-red-400 text-xs text-center">✕</button>
                </div>
              ))}
            </div>
            <button onClick={addEditItem} className="text-xs text-amber-400/70 hover:text-amber-400 mb-4">+ Добави</button>

            <div className="mb-5">
              <label className="text-xs text-white/70 block mb-1">Бележка</label>
              <textarea value={editForm.notes} onChange={e => updateEditField('notes', e.target.value)} rows={2} className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white/90 focus:outline-none resize-none" />
            </div>

            <div className="flex gap-2">
              <button onClick={closeEditModal} className="flex-1 py-2.5 rounded-xl text-xs font-medium bg-white/5 text-white/60 border border-white/10 hover:bg-white/10">Откажи</button>
              <button onClick={handleEditSave} disabled={editSaving} className="flex-1 py-2.5 rounded-xl text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 disabled:opacity-30">
                {editSaving ? '...' : '💾 Запази промените'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
