// app/(dashboard)/users/components/UserCard.tsx
'use client'
import { AppUser } from '@/src/types/database'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Админ',
  receptionist: 'Рецепционист',
  instructor: 'Инструктор',
}
const ROLE_GRADIENT: Record<string, string> = {
  admin: 'from-amber-400 to-orange-500',
  receptionist: 'from-sky-400 to-blue-500',
  instructor: 'from-emerald-400 to-green-500',
}
const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-amber-400/15 text-amber-400',
  receptionist: 'bg-sky-400/15 text-sky-400',
  instructor: 'bg-emerald-400/15 text-emerald-400',
}

interface UserCardProps {
  user: AppUser
  isLastAdmin: boolean   // UI-only guard — API enforces server-side
  onEdit: (user: AppUser) => void
  onToggleActive: (user: AppUser) => void
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

export default function UserCard({ user, isLastAdmin, onEdit, onToggleActive }: UserCardProps) {
  const initial = user.name.charAt(0).toUpperCase()
  const canDeactivate = user.is_active && !isLastAdmin

  return (
    <div className={`bg-white/[0.03] border border-white/[0.08] rounded-[14px] p-4 ${!user.is_active ? 'opacity-45' : ''}`}>
      {/* Top row */}
      <div className="flex items-center gap-3 mb-[14px]">
        <div className={`w-[46px] h-[46px] rounded-[13px] bg-gradient-to-br ${ROLE_GRADIENT[user.role]} flex items-center justify-center font-black text-[17px] text-[#0a0a0f] flex-shrink-0`}>
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold text-white">{user.name}</div>
          <span className={`inline-block mt-1 text-[10px] font-bold uppercase tracking-[0.08em] px-2 py-0.5 rounded-[6px] ${ROLE_BADGE[user.role]}`}>
            {ROLE_LABELS[user.role]}
          </span>
        </div>
        <span className={`text-[10px] font-semibold px-2.5 py-[3px] rounded-full whitespace-nowrap ${user.is_active ? 'bg-emerald-400/12 text-emerald-400' : 'bg-white/[0.06] text-white/30'}`}>
          {user.is_active ? '● Активен' : '○ Неактивен'}
        </span>
      </div>

      {/* Details */}
      <div className="border-t border-white/[0.06] pt-3 grid grid-cols-2 gap-2 mb-[14px]">
        <div>
          <div className="text-[10px] text-white/30 mb-0.5">Телефон</div>
          <div className="text-[12px] text-white/70">{user.phone ?? '—'}</div>
        </div>
        <div>
          <div className="text-[10px] text-white/30 mb-0.5">Рождена дата</div>
          <div className="text-[12px] text-white/70">{formatDate(user.birth_date)}</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onEdit(user)}
          className="flex-1 py-[7px] rounded-[8px] border border-white/[0.1] bg-white/[0.04] text-[12px] font-semibold text-white/60 hover:text-white/80 hover:bg-white/[0.07] transition-colors"
        >
          ✏️ Промени
        </button>

        {user.is_active ? (
          <button
            onClick={() => canDeactivate && onToggleActive(user)}
            disabled={!canDeactivate}
            title={isLastAdmin ? 'Не можеш да деактивираш единствения администратор' : undefined}
            className={`flex-1 py-[7px] rounded-[8px] border text-[12px] font-semibold transition-colors ${
              canDeactivate
                ? 'border-red-500/20 bg-red-500/[0.05] text-red-400/70 hover:text-red-400 hover:bg-red-500/[0.1]'
                : 'border-white/[0.06] bg-transparent text-white/20 cursor-not-allowed'
            }`}
          >
            ⊘ Деактивирай
          </button>
        ) : (
          <button
            onClick={() => onToggleActive(user)}
            className="flex-1 py-[7px] rounded-[8px] border border-emerald-500/20 bg-emerald-500/[0.05] text-[12px] font-semibold text-emerald-400/70 hover:text-emerald-400 hover:bg-emerald-500/[0.1] transition-colors"
          >
            ✓ Активирай
          </button>
        )}
      </div>
    </div>
  )
}
