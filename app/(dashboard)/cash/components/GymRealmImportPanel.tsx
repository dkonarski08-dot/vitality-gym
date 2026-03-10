// app/(dashboard)/cash/components/GymRealmImportPanel.tsx
import React from 'react'

interface Props {
  importFile: File | null
  setImportFile: (f: File | null) => void
  importing: boolean
  importResult: string | null
  dragOver: boolean
  setDragOver: (v: boolean) => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  setImportResult: (v: string | null) => void
  onImport: () => void
}

export function GymRealmImportPanel({
  importFile, setImportFile, importing, importResult,
  dragOver, setDragOver, fileInputRef, setImportResult, onImport,
}: Props) {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
      <div className="text-xs text-white/50 uppercase tracking-widest mb-1">GymRealm — Дневен отчет</div>
      <p className="text-xs text-white/30 mb-4">
        Качи отчета — ще запише данните за <span className="text-amber-400 font-medium">всички дни</span> от файла. Не променя ръчно въведените данни.
      </p>

      <label
        className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-5 cursor-pointer transition-colors mb-3 ${
          dragOver ? 'border-amber-500 bg-amber-500/10'
          : importFile ? 'border-emerald-500/50 bg-emerald-500/5'
          : 'border-white/15 hover:border-white/25'
        }`}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault(); setDragOver(false)
          const f = e.dataTransfer.files[0]; if (f) { setImportFile(f); setImportResult(null) }
        }}>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) { setImportFile(f); setImportResult(null) } }} />
        <span className="text-xl">{importFile ? '📄' : '📁'}</span>
        <span className="text-sm text-white/40">{importFile ? importFile.name : 'Избери или провлачи .xlsx'}</span>
      </label>

      {importResult && (
        <div className={`text-sm p-3 rounded-xl mb-3 ${
          importResult.startsWith('✅') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
          : importResult.startsWith('⚠️') ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
          : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}>{importResult}</div>
      )}

      <button onClick={onImport} disabled={importing || !importFile}
        className="w-full py-2.5 rounded-xl text-sm font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 disabled:opacity-30 transition-colors">
        {importing ? '⏳ Обработвам...' : '📥 Импортирай'}
      </button>
    </div>
  )
}
