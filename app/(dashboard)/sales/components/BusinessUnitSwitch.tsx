'use client'
import type { BusinessUnit } from '@/src/types/database'

interface Props {
  value: BusinessUnit
  onChange: (v: BusinessUnit) => void
}

export function BusinessUnitSwitch({ value, onChange }: Props) {
  return (
    <div className="flex gap-1 bg-white/[0.04] border border-white/[0.08] rounded-lg p-0.5">
      <button
        onClick={() => onChange('gym')}
        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
          value === 'gym'
            ? 'bg-amber-400/20 text-amber-400 border border-amber-400/30'
            : 'text-white/40 hover:text-white/70'
        }`}
      >
        GYM
      </button>
      <button
        onClick={() => onChange('hall')}
        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
          value === 'hall'
            ? 'bg-violet-400/20 text-violet-400 border border-violet-400/30'
            : 'text-white/40 hover:text-white/70'
        }`}
      >
        HALL
      </button>
    </div>
  )
}
