// app/(dashboard)/hall/components/ImportTab.tsx
import { monthLabel } from '../types'

interface Props {
  selectedMonth: string
  isLocked: boolean
  importing: boolean
  importResult: string | null
  gymrealmFile: File | null
  multisportFile: File | null
  coolfitFile: File | null
  dragOver: string | null
  setGymrealmFile: (f: File | null) => void
  setMultisportFile: (f: File | null) => void
  setCoolfitFile: (f: File | null) => void
  setDragOver: (key: string | null) => void
  onPrevMonth: () => void
  onNextMonth: () => void
  onImport: () => void
  onDrop: (e: React.DragEvent, setFile: (f: File | null) => void) => void
}

export function ImportTab({
  selectedMonth, isLocked, importing, importResult,
  gymrealmFile, multisportFile, coolfitFile, dragOver,
  setGymrealmFile, setMultisportFile, setCoolfitFile, setDragOver,
  onPrevMonth, onNextMonth, onImport, onDrop,
}: Props) {
  const fileSlots = [
    { key: 'gymrealm', label: 'GymRealm Export', required: true, accept: '.xlsx,.xls', file: gymrealmFile, setFile: setGymrealmFile },
    { key: 'multisport', label: 'Мултиспорт Service Report', required: false, accept: '.xlsx,.xls,.csv', file: multisportFile, setFile: setMultisportFile },
    { key: 'coolfit', label: 'Куулфит Report (PDF)', required: false, accept: '.pdf,.xlsx', file: coolfitFile, setFile: setCoolfitFile },
  ]

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-semibold mb-2">Import</h2>
      <div className="bg-white/[0.03] border border-violet-500/30 rounded-xl p-4 mb-6">
        <div className="text-xs text-white/50 uppercase tracking-wide mb-2">Месец за импорт</div>
        <div className="flex items-center gap-3">
          <button onClick={onPrevMonth} className="w-8 h-8 bg-white/[0.05] border border-white/10 rounded-lg flex items-center justify-center text-white/60 hover:text-white transition-colors">‹</button>
          <span className="text-lg font-bold text-violet-400 w-40 text-center">{monthLabel(selectedMonth)}</span>
          <button onClick={onNextMonth} className="w-8 h-8 bg-white/[0.05] border border-white/10 rounded-lg flex items-center justify-center text-white/60 hover:text-white transition-colors">›</button>
        </div>
      </div>
      {isLocked && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6 text-amber-400 text-sm">
          🔒 Месецът е заключен. Отключи го за да импортираш.
        </div>
      )}
      <div className="space-y-4">
        {fileSlots.map(item => (
          <div key={item.key} className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-medium text-white">{item.label}</div>
                <div className="text-xs text-white/40">{item.required ? 'Задължителен' : 'По избор — за reconciliation'}</div>
              </div>
              {item.file && <span className="text-xs text-emerald-400">✓ {item.file.name}</span>}
            </div>
            <label
              className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors ${
                dragOver === item.key ? 'border-violet-500 bg-violet-500/10' : item.file ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/15 hover:border-white/30'
              }`}
              onDragOver={e => { e.preventDefault(); setDragOver(item.key) }}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => onDrop(e, item.setFile)}
            >
              <input type="file" accept={item.accept} className="hidden" onChange={e => item.setFile(e.target.files?.[0] || null)} />
              <span className="text-sm text-white/40">{item.file ? '🔄 Смени файл' : '📁 Избери или провлачи файл тук'}</span>
            </label>
          </div>
        ))}
      </div>
      {importResult && (
        <div className={`mt-4 p-4 rounded-xl text-sm whitespace-pre-line ${
          importResult.startsWith('✅') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}>{importResult}</div>
      )}
      <button onClick={onImport} disabled={importing || !gymrealmFile || isLocked}
        className="mt-6 w-full bg-violet-500/20 border border-violet-500/30 hover:bg-violet-500/30 disabled:opacity-40 text-violet-300 py-3 rounded-xl font-medium transition-colors">
        {importing ? 'Импортирам...' : `📥 Импортирай за ${monthLabel(selectedMonth)}`}
      </button>
    </div>
  )
}
