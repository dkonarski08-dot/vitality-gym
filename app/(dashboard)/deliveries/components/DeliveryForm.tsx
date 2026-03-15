'use client'
// Tab 1 — Нова доставка — Layout A: Command Deck (split-screen)
import { useRef, useState, useEffect } from 'react'
import { PRODUCT_CATEGORIES } from '@/src/constants/categories'
import { UNITS } from '@/src/types/deliveries'
import type { DeliveriesHookReturn } from '../hooks/useDeliveries'

interface DeliveryFormProps {
  hook: DeliveriesHookReturn
  onSaveSuccess: () => void
}

function StepBadge({ num, label, done, active }: { num: number; label: string; done: boolean; active: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${done ? 'text-emerald-400' : active ? 'text-amber-400' : 'text-white/25'}`}>
      <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold flex-shrink-0 transition-colors ${
        done ? 'bg-emerald-500/20 border-emerald-500/40' :
        active ? 'bg-amber-400/15 border-amber-400/40' :
        'border-white/15'
      }`}>
        {done ? '✓' : num}
      </div>
      <span className="font-medium whitespace-nowrap">{label}</span>
    </div>
  )
}

export default function DeliveryForm({ hook, onSaveSuccess }: DeliveryFormProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const extraFileRef = useRef<HTMLInputElement>(null)

  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [addedProducts, setAddedProducts] = useState<Set<string>>(new Set())

  const {
    photoPreview, photoBase64, extraPhotos, parsing, parseError, saving, dragging,
    supplierName, invoiceNumber, invoiceDate, paymentDue, paymentMethod,
    totalAmount, formNotes, items, aiParsed, formReady,
    suppliers, deliveryProducts, processFile, handleParse, handleSave, resetForm,
    addItem, addItemWithName, updateItem, removeItem, hasErrors,
    setDragging, setPhotoPreview, setPhotoBase64, removeExtraPhoto,
    setSupplierName, setInvoiceNumber, setInvoiceDate, setPaymentDue,
    setPaymentMethod, setTotalAmount, setFormNotes, setFormReady,
    pendingDuplicate, confirmUseExisting, confirmCreateNew, dismissDuplicate,
    aiSuggestedAmount, aiDetectedProducts,
  } = hook

  // Reset added products state when form resets
  useEffect(() => {
    if (!formReady) setAddedProducts(new Set())
  }, [formReady])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) processFile(e.target.files[0])
  }
  const onExtraFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) processFile(e.target.files[0], true)
  }
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0])
  }

  const onSubmit = async () => {
    setSubmitAttempted(true)
    if (!totalAmount.trim()) return
    const success = await handleSave()
    if (success) {
      setSubmitAttempted(false)
      onSaveSuccess()
    }
  }

  // Toggle AI product: add or remove from items list
  const handleToggleAiProduct = (name: string) => {
    if (addedProducts.has(name)) {
      // Find last item with this name and remove it
      let lastIdx = -1
      items.forEach((item, i) => {
        if (item.product_name.toLowerCase().trim() === name.toLowerCase().trim()) lastIdx = i
      })
      if (lastIdx !== -1) removeItem(lastIdx)
      setAddedProducts(prev => { const s = new Set(prev); s.delete(name); return s })
    } else {
      addItemWithName(name)
      setAddedProducts(prev => new Set([...prev, name]))
    }
  }

  const getLastPrice = (productName: string): number | null => {
    if (!productName.trim()) return null
    const found = deliveryProducts.find(p => p.name.toLowerCase().trim() === productName.toLowerCase().trim())
    return found?.last_price ?? null
  }

  const totalAmountMissing = submitAttempted && !totalAmount.trim()

  // Progress step indicators
  const step1Done = !!photoPreview
  const step2Done = formReady
  const step2Active = !!photoPreview && !formReady
  const step3Active = formReady

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* Steps sub-header */}
      <div className="flex-shrink-0 flex items-center px-6 py-2 border-b border-white/[0.05] bg-white/[0.01]">
        <StepBadge num={1} label="Снимка" done={step1Done} active={!step1Done} />
        <span className="text-white/15 text-xs px-1">›</span>
        <StepBadge num={2} label="AI Разпознаване" done={step2Done} active={step2Active} />
        <span className="text-white/15 text-xs px-1">›</span>
        <StepBadge num={3} label="Провери и запази" done={false} active={step3Active} />
      </div>

      {/* Split body */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT PANEL: photo + AI products ── */}
        <div className="w-[360px] flex-shrink-0 flex flex-col border-r border-white/[0.06] overflow-y-auto bg-white/[0.008]">

          {/* Photo zone */}
          <div className="flex-1 p-5">
            {!photoPreview ? (
              <label
                onDrop={onDrop}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-10 cursor-pointer transition-all h-[220px] ${dragging ? 'border-amber-400/60 bg-amber-400/[0.05]' : 'border-white/12 hover:border-amber-400/30 hover:bg-amber-400/[0.02]'}`}
              >
                <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={onFileChange} />
                <div className="text-3xl mb-3">{dragging ? '📥' : '📸'}</div>
                <div className="text-sm font-medium text-white/70">{dragging ? 'Пусни тук' : 'Снимай или пусни файл'}</div>
                <div className="text-xs text-white/30 mt-1.5">Снимка или PDF — без сенки</div>
              </label>
            ) : (
              <div>
                {/* Preview */}
                <div className="relative mb-3">
                  {photoPreview?.startsWith('📄') ? (
                    <div className="w-full h-[180px] bg-white/[0.03] border border-white/10 rounded-xl flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-3xl mb-2">📄</div>
                        <div className="text-xs text-white/50">{photoPreview}</div>
                      </div>
                    </div>
                  ) : (
                    <img src={photoPreview!} alt="" className="w-full max-h-[230px] object-contain rounded-xl border border-white/10" />
                  )}
                  <button
                    onClick={() => { setPhotoPreview(null); setPhotoBase64(null) }}
                    className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/70 text-white/70 hover:text-white flex items-center justify-center text-xs border border-white/10"
                  >✕</button>
                </div>

                {parseError && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-3 text-xs text-amber-400">{parseError}</div>
                )}

                {!formReady && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleParse}
                      disabled={parsing || !photoBase64}
                      className="flex-1 py-3 rounded-xl text-sm font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                      {parsing
                        ? <><span className="w-4 h-4 border-2 border-amber-300/30 border-t-amber-300 rounded-full animate-spin" />Анализирам...</>
                        : '🤖 Разпознай с AI'
                      }
                    </button>
                    <button
                      onClick={() => { setFormReady(true); addItem() }}
                      className="py-3 px-4 rounded-xl text-sm font-medium bg-white/[0.04] text-white/50 border border-white/10 hover:bg-white/[0.08]"
                    >
                      Ръчно
                    </button>
                  </div>
                )}

                {/* Extra photos (shown after formReady) */}
                {formReady && (
                  <div className="mt-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] text-white/35">Допълнителни:</span>
                      {extraPhotos.map((ep, i) => (
                        <div key={i} className="relative">
                          <img src={ep.preview} alt="" className="w-10 h-10 object-cover rounded-lg border border-white/10" />
                          <button onClick={() => removeExtraPhoto(i)} className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[8px] text-white flex items-center justify-center">✕</button>
                        </div>
                      ))}
                      <label className="w-10 h-10 border border-dashed border-white/15 rounded-lg flex items-center justify-center cursor-pointer hover:border-amber-400/30 text-white/30 text-base">
                        <input ref={extraFileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onExtraFileChange} />+
                      </label>
                    </div>
                    <div className="text-[10px] text-white/20 mt-1.5">Стокова разписка, касов бон и др.</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* AI detected products panel */}
          {aiDetectedProducts.length > 0 && (
            <div className="border-t border-white/[0.06] p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest bg-amber-400/10 border border-amber-400/20 text-amber-400">
                  🤖 AI откри
                </div>
                <span className="text-[10px] text-white/30 ml-auto">{aiDetectedProducts.length} продукта</span>
              </div>
              <div className="space-y-1.5">
                {aiDetectedProducts.map((name, i) => {
                  const isAdded = addedProducts.has(name)
                  return (
                    <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white/[0.025] border border-white/[0.06]">
                      <span className="text-xs text-white/60 flex-1 truncate">{name}</span>
                      <button
                        onClick={() => handleToggleAiProduct(name)}
                        className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-md border transition-all ${
                          isAdded
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-red-500/10 hover:border-red-500/25 hover:text-red-400'
                            : 'bg-transparent border-amber-400/25 text-amber-400/80 hover:border-amber-400/50 hover:text-amber-400'
                        }`}
                      >
                        {isAdded ? '✓ Добавен' : '+ Добави'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL: form fields + products ── */}
        <div className="flex-1 overflow-y-auto">
          {!formReady ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-10 select-none">
              <div className="text-5xl mb-4 opacity-10">📋</div>
              <div className="text-sm text-white/25 font-medium">Снимай фактурата и натисни „Разпознай с AI"</div>
              <div className="text-xs text-white/15 mt-1.5">или попълни ръчно</div>
            </div>
          ) : (
            <div className="p-6 space-y-6 max-w-3xl">

              {aiParsed && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
                  ⚠️ Провери внимателно данните от AI — може да има грешки
                </div>
              )}

              {/* Invoice fields */}
              <div>
                <div className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-3">Данни от фактура</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-white/50 block mb-1">
                      Доставчик {!supplierName.trim() && <span className="text-red-400">*</span>}
                    </label>
                    <input
                      value={supplierName}
                      onChange={e => setSupplierName(e.target.value)}
                      list="sup-list"
                      className={`w-full bg-white/[0.04] border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none placeholder:text-white/20 ${!supplierName.trim() ? 'border-red-500/40' : 'border-white/[0.12] focus:border-amber-400/50'}`}
                    />
                    <datalist id="sup-list">{suppliers.map(s => <option key={s.id} value={s.name} />)}</datalist>
                  </div>
                  <div>
                    <label className="text-[10px] text-white/50 block mb-1">Номер фактура</label>
                    <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.12] rounded-lg px-3 py-2.5 text-sm text-white focus:border-amber-400/50 focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/50 block mb-1">Дата</label>
                    <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.12] rounded-lg px-3 py-2.5 text-sm text-white focus:border-amber-400/50 focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/50 block mb-1">Падеж</label>
                    <input type="date" value={paymentDue} onChange={e => setPaymentDue(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.12] rounded-lg px-3 py-2.5 text-sm text-white focus:border-amber-400/50 focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/50 block mb-1">Плащане</label>
                    <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.12] rounded-lg px-3 py-2.5 text-sm text-white focus:border-amber-400/50 focus:outline-none">
                      <option value="">—</option>
                      <option value="cash">В брой</option>
                      <option value="bank_transfer">Банков път</option>
                      <option value="card">Карта</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-white/50 block mb-1">
                      Сума с ДДС (€) <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={totalAmount}
                      onChange={e => setTotalAmount(e.target.value)}
                      placeholder="0.00"
                      className={`w-full bg-white/[0.04] border rounded-lg px-3 py-2.5 text-sm font-bold text-white focus:outline-none placeholder:text-white/20 ${totalAmountMissing ? 'border-red-500/50 focus:border-red-500/70' : 'border-white/[0.12] focus:border-amber-400/50'}`}
                    />
                    {aiSuggestedAmount && (
                      <div className="text-[10px] text-white/35 mt-1">AI предлага: €{parseFloat(aiSuggestedAmount).toFixed(2)}</div>
                    )}
                    {totalAmountMissing && <div className="text-[10px] text-red-400 mt-1">Задължително поле</div>}
                  </div>
                </div>
              </div>

              {/* Products table */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">Продукти</div>
                  {hasErrors() && <div className="text-[10px] text-red-400">* Попълни цените</div>}
                </div>

                <div className="space-y-1.5">
                  {/* Column headers */}
                  {items.length > 0 && (
                    <div className="grid grid-cols-[2fr_0.5fr_0.6fr_1fr_1.2fr_1fr_20px] gap-2 px-3 pb-1">
                      {['Продукт', 'Кол.', 'Ед.', 'Цена €', 'Категория', 'Годен до', ''].map(h => (
                        <span key={h} className="text-[9px] font-semibold text-white/25 uppercase tracking-widest">{h}</span>
                      ))}
                    </div>
                  )}

                  {items.map((item, idx) => {
                    const pM = item.product_name.trim() && item.unit_price == null
                    const lastPrice = getLastPrice(item.product_name)
                    return (
                      <div key={idx} className={`border rounded-xl p-2.5 ${item.uncertain ? 'bg-amber-500/[0.04] border-amber-500/20' : pM ? 'bg-red-500/[0.04] border-red-500/20' : 'bg-white/[0.02] border-white/[0.07]'}`}>
                        {item.uncertain && <div className="text-[9px] text-amber-400 mb-1.5">⚠ Провери данните</div>}
                        <div className="grid grid-cols-[2fr_0.5fr_0.6fr_1fr_1.2fr_1fr_20px] gap-2 items-center">
                          <div>
                            <input
                              value={item.product_name}
                              onChange={e => updateItem(idx, 'product_name', e.target.value)}
                              list={`prod-list-${idx}`}
                              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-md px-2 py-1.5 text-xs text-white focus:border-amber-400/40 focus:outline-none"
                            />
                            <datalist id={`prod-list-${idx}`}>
                              {deliveryProducts.map(p => <option key={p.name} value={p.name} />)}
                            </datalist>
                          </div>
                          <input
                            type="number" step="0.01" value={item.quantity}
                            onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-md px-1.5 py-1.5 text-xs text-white text-center focus:border-amber-400/40 focus:outline-none"
                          />
                          <select
                            value={item.unit}
                            onChange={e => updateItem(idx, 'unit', e.target.value)}
                            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-md px-1 py-1.5 text-xs text-white focus:outline-none"
                          >
                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                          <div>
                            <input
                              type="number" step="0.01"
                              value={item.unit_price ?? ''}
                              onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value) || null)}
                              placeholder={pM ? '!' : ''}
                              className={`w-full bg-white/[0.04] border rounded-md px-2 py-1.5 text-xs text-white text-right focus:outline-none ${pM ? 'border-red-500/50 placeholder:text-red-400/60' : 'border-white/[0.08]'}`}
                            />
                            {lastPrice !== null && (
                              <div className="text-[9px] text-white/30 mt-0.5 text-right">€{lastPrice.toFixed(2)}</div>
                            )}
                          </div>
                          <select
                            value={item.category}
                            onChange={e => updateItem(idx, 'category', e.target.value)}
                            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-md px-1 py-1.5 text-xs text-white focus:outline-none"
                          >
                            {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <input
                            type="date"
                            value={item.expiry_date ?? ''}
                            onChange={e => updateItem(idx, 'expiry_date', e.target.value || null)}
                            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-md px-2 py-1.5 text-xs text-white focus:outline-none"
                          />
                          <button onClick={() => removeItem(idx)} className="text-red-400/40 hover:text-red-400 text-xs flex items-center justify-center">✕</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <button onClick={addItem} className="text-[11px] text-amber-400/60 hover:text-amber-400 mt-2">+ Добави ред</button>
              </div>

              {/* Notes */}
              <div>
                <label className="text-[10px] text-white/50 block mb-1">Бележка</label>
                <textarea
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-white/[0.04] border border-white/[0.12] rounded-lg px-3 py-2.5 text-sm text-white/80 focus:border-amber-400/50 focus:outline-none resize-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Sticky footer ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-t border-white/[0.06] bg-[#060609]/80 backdrop-blur-sm">
        <div className="flex items-baseline gap-3">
          <span className="text-[10px] text-white/30 uppercase tracking-widest">Обща сума</span>
          <span className="text-xl font-bold text-amber-400 tabular-nums">
            {totalAmount ? `€ ${parseFloat(totalAmount).toFixed(2)}` : '€ —'}
          </span>
        </div>
        {formReady && (
          <div className="flex gap-2.5">
            <button
              onClick={resetForm}
              className="px-4 py-2.5 rounded-lg text-xs font-medium bg-white/[0.04] text-white/50 border border-white/[0.08] hover:bg-white/[0.08] transition-colors"
            >
              Откажи
            </button>
            <button
              onClick={onSubmit}
              disabled={saving || !supplierName.trim() || hasErrors()}
              className="px-6 py-2.5 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 disabled:opacity-30 transition-colors"
            >
              {saving ? 'Запазвам...' : '💾 Запази доставката'}
            </button>
          </div>
        )}
      </div>

      {/* Duplicate supplier confirmation modal */}
      {pendingDuplicate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={dismissDuplicate} />
          <div className="relative bg-[#0f0f14] border border-white/[0.1] rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="w-10 h-10 rounded-full bg-amber-400/10 border border-amber-400/20 flex items-center justify-center mb-4">
              <span className="text-amber-400 text-lg">⚠</span>
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">Възможен дубликат на доставчик</h3>
            <p className="text-sm text-white/50 mb-5 leading-relaxed">
              Намерихме съществуващ доставчик близо до{' '}
              <span className="text-white font-medium">&quot;{pendingDuplicate.fromInvoice.name}&quot;</span>.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-3">
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">От фактурата</p>
                <p className="text-sm font-semibold text-white">{pendingDuplicate.fromInvoice.name}</p>
                {pendingDuplicate.fromInvoice.eik && <p className="text-xs text-white/40 mt-1">ЕИК: {pendingDuplicate.fromInvoice.eik}</p>}
              </div>
              <div className="bg-amber-400/[0.05] border border-amber-400/20 rounded-xl p-3">
                <p className="text-[10px] text-amber-400/60 uppercase tracking-wider mb-2">Съществуващ</p>
                <p className="text-sm font-semibold text-amber-400">{pendingDuplicate.existing.name}</p>
                {pendingDuplicate.existing.eik && <p className="text-xs text-white/40 mt-1">ЕИК: {pendingDuplicate.existing.eik}</p>}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={confirmUseExisting}
                disabled={saving}
                className="w-full py-2.5 rounded-xl text-sm font-medium bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
              >
                Използвай &quot;{pendingDuplicate.existing.name}&quot;
              </button>
              <button
                onClick={confirmCreateNew}
                disabled={saving}
                className="w-full py-2.5 rounded-xl text-sm text-white/50 bg-white/[0.03] border border-white/[0.07] hover:bg-white/[0.06] transition-colors disabled:opacity-50"
              >
                Създай нов доставчик
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
