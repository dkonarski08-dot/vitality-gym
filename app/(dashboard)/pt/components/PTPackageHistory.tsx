// app/(dashboard)/pt/components/PTPackageHistory.tsx
'use client'

import { useState } from 'react'
import { PTPackage } from '../page'

interface Props {
  packages: PTPackage[]
}

function formatDateBG(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

export default function PTPackageHistory({ packages }: Props) {
  const [showAllPkgs, setShowAllPkgs] = useState(false)

  if (packages.length === 0) return null

  return (
    <div>
      <button
        onClick={() => setShowAllPkgs(v => !v)}
        className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-white/30 hover:text-white/50 transition-colors mb-2">
        <span>История на пакетите ({packages.length})</span>
        <span className={`transition-transform ${showAllPkgs ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {showAllPkgs && (
        <div className="space-y-1.5">
          {packages.map(p => (
            <div key={p.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04] opacity-60">
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white/60">
                  {p.total_sessions} сесии
                  {p.price_total != null && <span className="text-white/30 ml-2">· €{p.price_total}</span>}
                </div>
                <div className="text-[10px] text-white/30 mt-0.5">
                  {p.purchased_at && formatDateBG(p.purchased_at)}
                  {p.expires_at && ` – ${formatDateBG(p.expires_at)}`}
                </div>
              </div>
              <div className="text-xs text-white/40 shrink-0">
                {p.used_sessions}/{p.total_sessions} използвани
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
