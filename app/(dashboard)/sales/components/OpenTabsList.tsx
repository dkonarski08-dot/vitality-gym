'use client'

import { useState } from 'react'
import type { OpenTab } from '@/src/types/database'

interface Props {
  tabs: OpenTab[]
  loading: boolean
  userRole: string
  onPay: (tabId: string, method: 'cash' | 'card') => Promise<void>
  onDelete: (tabId: string) => Promise<void>
  onRefresh: () => void
}

export function OpenTabsList({ tabs, loading, userRole, onPay, onDelete, onRefresh }: Props) {
  const [payingId, setPayingId] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const totalAmount = tabs.reduce((s, t) => s + t.total_amount, 0)

  const handlePay = async (tabId: string, method: 'cash' | 'card') => {
    setProcessingId(tabId)
    try {
      await onPay(tabId, method)
    } finally {
      setProcessingId(null)
      setPayingId(null)
    }
  }

  const handleDelete = async (tabId: string) => {
    if (!window.confirm('Сигурен ли си, че искаш да изтриеш тази сметка?')) return
    setProcessingId(tabId)
    try {
      await onDelete(tabId)
    } finally {
      setProcessingId(null)
    }
  }

  const formatItems = (tab: OpenTab) => {
    const names = tab.items.map(i => i.name)
    if (names.length <= 3) return names.join(', ')
    return `${names.slice(0, 3).join(', ')} ...+${names.length - 3}`
  }

  const formatDateTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString('bg-BG', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Summary banner */}
      {tabs.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 bg-amber-400/10 border border-amber-400/20 text-amber-400 rounded-lg text-sm">
          <span>
            Неплатени: <strong>{tabs.length} бр.</strong>
          </span>
          <span>
            Общо: <strong>€{totalAmount.toFixed(2)}</strong>
          </span>
          <button
            onClick={onRefresh}
            className="text-amber-400/70 hover:text-amber-400 text-xs transition-colors"
          >
            ↻ Обнови
          </button>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-5 h-5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
        </div>
      )}

      {!loading && tabs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-white/30">
          <div className="text-4xl mb-3">📋</div>
          <div className="text-sm">Няма отворени сметки</div>
        </div>
      )}

      {!loading && tabs.length > 0 && (
        <div className="space-y-2">
          {tabs.map(tab => (
            <div
              key={tab.id}
              className="bg-white/[0.03] border border-white/10 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3"
            >
              {/* Client */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">
                  {tab.client?.name ?? 'Анонимен'}
                </div>
                <div className="text-xs text-white/40 mt-0.5 truncate">{formatItems(tab)}</div>
                <div className="text-xs text-white/30 mt-0.5">{formatDateTime(tab.created_at)}</div>
              </div>

              {/* Amount */}
              <div className="text-amber-400 font-semibold text-sm shrink-0">
                €{tab.total_amount.toFixed(2)}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {payingId === tab.id ? (
                  <>
                    <button
                      onClick={() => handlePay(tab.id, 'cash')}
                      disabled={processingId === tab.id}
                      className="px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs rounded-lg hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                    >
                      💵 Брой
                    </button>
                    <button
                      onClick={() => handlePay(tab.id, 'card')}
                      disabled={processingId === tab.id}
                      className="px-3 py-1.5 bg-sky-500/20 border border-sky-500/30 text-sky-400 text-xs rounded-lg hover:bg-sky-500/30 transition-colors disabled:opacity-50"
                    >
                      💳 Карта
                    </button>
                    <button
                      onClick={() => setPayingId(null)}
                      className="px-2 py-1.5 text-white/40 text-xs hover:text-white/70 transition-colors"
                    >
                      Отказ
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setPayingId(tab.id)}
                      disabled={processingId === tab.id}
                      className="px-3 py-1.5 bg-amber-400/20 border border-amber-400/30 text-amber-400 text-xs rounded-lg hover:bg-amber-400/30 transition-colors disabled:opacity-50"
                    >
                      Плати
                    </button>
                    {userRole === 'admin' && (
                      <button
                        onClick={() => handleDelete(tab.id)}
                        disabled={processingId === tab.id}
                        className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50"
                      >
                        Изтрий
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
