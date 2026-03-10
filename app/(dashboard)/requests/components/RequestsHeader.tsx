// app/(dashboard)/requests/components/RequestsHeader.tsx

interface Props {
  userRole: string
  cleaning: boolean
  cleanResult: string | null
  onCleanup: () => void
}

export function RequestsHeader({ userRole, cleaning, cleanResult, onCleanup }: Props) {
  return (
    <div className="sticky top-0 z-30 bg-[#060609]/80 backdrop-blur-xl border-b border-white/[0.06] px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Заявки</h1>
          <p className="text-sm text-white/60 mt-0.5">Поръчки към доставчици</p>
        </div>
        {userRole === 'admin' && (
          <button
            onClick={onCleanup}
            disabled={cleaning}
            className="px-3 py-1.5 rounded-lg text-[10px] font-medium bg-white/5 text-white/40 border border-white/[0.06] hover:text-white/60 disabled:opacity-30"
          >
            {cleaning ? '🔍 Проверявам...' : cleanResult || '🤖 Провери имена'}
          </button>
        )}
      </div>
    </div>
  )
}
