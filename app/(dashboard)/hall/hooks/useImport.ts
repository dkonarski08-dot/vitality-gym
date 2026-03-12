import { useState } from 'react'

export async function parseCoolfitInBrowser(file: File): Promise<Record<string, { visits: number; rate_eur: number; total_eur: number }>> {
  const text = await file.text()
  const results: Record<string, { visits: number; rate_eur: number; total_eur: number }> = {}
  const nameMap: Record<string, string> = {
    'рашко': 'Класическа йога', 'rashko': 'Класическа йога', 'yoga': 'Класическа йога',
    'флоу': 'Виняса Флоу Йога', 'flow': 'Виняса Флоу Йога', 'vinyasa': 'Виняса Флоу Йога',
    'пилатес': 'Пилатес', 'pilates': 'Пилатес',
    'зумба': 'Zumba Fitness', 'zumba': 'Zumba Fitness',
    'фит': 'Fit Lady', 'lady fit': 'Fit Lady',
  }
  const lines = text.split(/[\n\r]+/).map((l: string) => l.trim()).filter(Boolean)
  for (const line of lines) {
    const match = line.match(/^(.+?)\s+(\d+)\s+([\d.]+)\s*€.*?([\d.]+)\s*€/)
    if (!match) continue
    const rawName = match[1].toLowerCase().trim()
    const visits = parseInt(match[2])
    const rate = parseFloat(match[3])
    const total = parseFloat(match[4])
    const mappedKey = Object.keys(nameMap).find(k => rawName.includes(k))
    if (mappedKey && visits > 0) results[nameMap[mappedKey]] = { visits, rate_eur: rate, total_eur: total }
  }
  return results
}

export function useImport(
  selectedMonth: string,
  monthLabel: (m?: string) => string,
  loadData: () => Promise<void>,
setActiveTab: (tab: 'attendance' | 'yearly' | 'reconciliation' | 'clients' | 'import' | 'config') => void
) {
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [gymrealmFile, setGymrealmFile] = useState<File | null>(null)
  const [multisportFile, setMultisportFile] = useState<File | null>(null)
  const [coolfitFile, setCoolfitFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)

  const handleImport = async () => {
    if (!gymrealmFile) { setImportResult('❌ Качи GymRealm файл'); return }
    setImporting(true); setImportResult(null)
    try {
      const fd = new FormData()
      fd.append('month', selectedMonth)
      fd.append('gymrealm', gymrealmFile)
      if (multisportFile) fd.append('multisport', multisportFile)
      if (coolfitFile) {
        const coolfitParsed = await parseCoolfitInBrowser(coolfitFile)
        fd.append('coolfit_json', JSON.stringify(coolfitParsed))
      }
      const res = await fetch('/api/hall/import', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.error) {
        setImportResult(`❌ ${data.error}`)
      } else {
        const anomalyText = data.anomalies?.length > 0 ? `\n\n⚠️ ${data.anomalies[0]}` : ''
        setImportResult(`✅ Импортирани ${data.classes_processed} класа за ${monthLabel()}${anomalyText}`)
        loadData()
        setActiveTab('attendance')
      }
    } catch (e) {
      setImportResult(`❌ ${e instanceof Error ? e.message : 'Грешка'}`)
    } finally {
      setImporting(false)
    }
  }

  const handleDrop = (e: React.DragEvent, setFile: (f: File | null) => void) => {
    e.preventDefault(); setDragOver(null)
    const file = e.dataTransfer.files[0]
    if (file) setFile(file)
  }

  return {
    importing, importResult, setImportResult,
    gymrealmFile, setGymrealmFile,
    multisportFile, setMultisportFile,
    coolfitFile, setCoolfitFile,
    dragOver, setDragOver,
    handleImport, handleDrop,
  }
}