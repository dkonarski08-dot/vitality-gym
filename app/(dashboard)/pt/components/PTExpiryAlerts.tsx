// app/(dashboard)/pt/components/PTExpiryAlerts.tsx
'use client'

import { useState } from 'react'

interface ExpiringPackage {
  id: string
  client_id: string
  expires_at: string
  clientName: string
}

interface Props {
  renewalNeeded: number
  expiringPackages: ExpiringPackage[]
  cancelledLate: number
}

export default function PTExpiryAlerts({ renewalNeeded, expiringPackages, cancelledLate }: Props) {
  const [showExpiringClients, setShowExpiringClients] = useState(false)

  if (renewalNeeded === 0 && expiringPackages.length === 0 && cancelledLate === 0) return null

  return (
    <div className="flex flex-wrap gap-3">
      {/* Renewal needed */}
      {renewalNeeded > 0 && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">
          <span className="text-lg">⚠️</span>
          <div>
            <div className="text-xs font-semibold text-red-400">{renewalNeeded} клиента</div>
            <div className="text-[10px] text-red-400/70">трябва подновяване на пакет</div>
          </div>
        </div>
      )}

      {/* Expiring packages — expandable list */}
      {expiringPackages.length > 0 && (
        <div className="flex-1 min-w-[200px]">
          <button
            onClick={() => setShowExpiringClients(!showExpiringClients)}
            className="w-full flex items-center justify-between gap-2 bg-amber-400/[0.05] border border-amber-400/10 rounded-xl px-4 py-2.5 hover:bg-amber-400/[0.08] transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-lg">⏰</span>
              <div className="text-left">
                <div className="text-xs font-semibold text-amber-400">{expiringPackages.length} пакета изтичат</div>
                <div className="text-[10px] text-amber-400/60">до 2 седмици</div>
              </div>
            </div>
            <span className={`text-amber-400/50 text-xs transition-transform ${showExpiringClients ? 'rotate-180' : ''}`}>▾</span>
          </button>
          {showExpiringClients && (
            <div className="mt-1.5 bg-amber-400/[0.03] border border-amber-400/10 rounded-xl overflow-hidden">
              {expiringPackages.map(pkg => {
                const daysLeft = Math.ceil((new Date(pkg.expires_at).getTime() - Date.now()) / 86400000)
                return (
                  <div key={pkg.id} className="flex items-center justify-between px-4 py-2 border-b border-amber-400/[0.06] last:border-0">
                    <div>
                      <div className="text-xs text-white/70">{pkg.clientName}</div>
                      <div className="text-[10px] text-white/30">
                        {new Date(pkg.expires_at).toLocaleDateString('bg-BG', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                    <span className={`text-[11px] font-medium ${daysLeft <= 3 ? 'text-red-400' : 'text-amber-400'}`}>
                      {daysLeft}д
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Late cancellations */}
      {cancelledLate > 0 && (
        <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-2.5">
          <span className="text-lg">📵</span>
          <div>
            <div className="text-xs font-semibold text-orange-400">{cancelledLate} отмени</div>
            <div className="text-[10px] text-orange-400/70">последен момент (&lt;24ч)</div>
          </div>
        </div>
      )}
    </div>
  )
}
