// app/(dashboard)/requests/components/RequestsHeader.tsx

interface Props {
  userRole: string
  statusFilter: string
  onStatusFilter: (s: string) => void
  onNewRequest: () => void
  cleaning: boolean
  cleanResult: string | null
  onCleanNames: () => void
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'Всички' },
  { value: 'draft', label: 'Чернова' },
  { value: 'submitted', label: 'Изпратена' },
  { value: 'approved', label: 'Одобрена' },
  { value: 'rejected', label: 'Отхвърлена' },
]

export function RequestsHeader({
  userRole,
  statusFilter,
  onStatusFilter,
  onNewRequest,
  cleaning,
  cleanResult,
  onCleanNames,
}: Props) {
  return (
    <div className="sticky top-0 z-30 bg-[#060609]/80 backdrop-blur-xl border-b border-white/[0.06] px-6 py-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-white">Заявки за доставки</h1>
          <p className="text-sm text-white/50 mt-0.5">Поръчки към доставчици</p>
        </div>
        <div className="flex items-center gap-3">
          {userRole === 'admin' && (
            <button
              onClick={onCleanNames}
              disabled={cleaning}
              className="px-3 py-1.5 rounded-lg text-[10px] font-medium bg-white/5 text-white/40 border border-white/[0.06] hover:text-white/60 disabled:opacity-30 transition-colors"
            >
              {cleaning ? '⏳ Обработвам...' : cleanResult ?? '🤖 Генерирай чисти имена'}
            </button>
          )}
          <button
            onClick={onNewRequest}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-amber-400 to-orange-500 text-black hover:opacity-90 transition-opacity"
          >
            + Нова заявка
          </button>
        </div>
      </div>

      {userRole === 'admin' && (
        <div className="flex items-center gap-1.5 mt-3">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => onStatusFilter(opt.value)}
              className={`px-3 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                statusFilter === opt.value
                  ? 'bg-amber-400/15 text-amber-400'
                  : 'bg-white/5 text-white/40 hover:text-white/60'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
