// app/(dashboard)/notes/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from '@/hooks/useSession'

interface Note {
  id: string
  author_name: string
  author_role: string
  title: string | null
  content: string
  priority: 'urgent' | 'normal' | 'info'
  pinned: boolean
  expires_at: string | null
  visible_to: string[]
  created_at: string
}

const PRIORITY_CONFIG = {
  urgent: { label: 'Спешно', color: 'border-red-500/30 bg-red-500/[0.04]', badge: 'bg-red-500/20 text-red-400', dot: 'bg-red-400' },
  normal: { label: 'Нормално', color: 'border-white/[0.06] bg-white/[0.02]', badge: 'bg-amber-500/20 text-amber-400', dot: 'bg-amber-400' },
  info: { label: 'Инфо', color: 'border-blue-500/20 bg-blue-500/[0.03]', badge: 'bg-blue-500/20 text-blue-400', dot: 'bg-blue-400' },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'сега'
  if (mins < 60) return `${mins} мин`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}ч`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}д`
  return new Date(dateStr).toLocaleDateString('bg-BG', { day: 'numeric', month: 'short' })
}

export default function NotesPage() {
  const { userRole, userName } = useSession()
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)

  // New note form
  const [showForm, setShowForm] = useState(false)
  const [newContent, setNewContent] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newPriority, setNewPriority] = useState<'urgent' | 'normal' | 'info'>('normal')
  const [newPinned, setNewPinned] = useState(false)
  const [newExpiresAt, setNewExpiresAt] = useState('')
  const [newVisibleTo, setNewVisibleTo] = useState<string[]>(['admin', 'receptionist', 'instructor'])
  const [saving, setSaving] = useState(false)

  const loadNotes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/notes?role=${userRole}`)
      const data = await res.json()
      setNotes(data.notes || [])
    } catch (err) {
      console.error('Failed to load notes:', err)
    }
    setLoading(false)
  }, [userRole])

  useEffect(() => { loadNotes() }, [loadNotes])

  const handleCreate = async () => {
    if (!newContent.trim()) return
    setSaving(true)
    try {
      await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author_name: userName,
          author_role: userRole,
          title: newTitle,
          content: newContent,
          priority: newPriority,
          pinned: newPinned,
          expires_at: newExpiresAt || null,
          visible_to: newVisibleTo,
        }),
      })
      // Reset form
      setNewContent('')
      setNewTitle('')
      setNewPriority('normal')
      setNewPinned(false)
      setNewExpiresAt('')
      setNewVisibleTo(['admin', 'receptionist', 'instructor'])
      setShowForm(false)
      await loadNotes()
    } catch (err) {
      console.error('Create failed:', err)
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Изтрий тази бележка?')) return
    await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    })
    await loadNotes()
  }

  const handleTogglePin = async (id: string, currentPinned: boolean) => {
    await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_pin', id, pinned: !currentPinned }),
    })
    await loadNotes()
  }

  const toggleVisibility = (role: string) => {
    setNewVisibleTo(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    )
  }

  const pinnedNotes = notes.filter(n => n.pinned)
  const regularNotes = notes.filter(n => !n.pinned)

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#060609]/80 backdrop-blur-xl border-b border-white/[0.06] px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Бележки</h1>
            <p className="text-xs text-white/30 mt-0.5">Комуникация между екипа</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 rounded-xl text-xs font-medium bg-amber-400/10 text-amber-400 border border-amber-400/20 hover:bg-amber-400/20 transition-colors"
          >
            {showForm ? 'Затвори' : '+ Нова бележка'}
          </button>
        </div>
      </div>

      <div className="p-6 max-w-3xl mx-auto">

        {/* ══════ New note form ══════ */}
        {showForm && (
          <div className="bg-[#0f0f14] border border-white/[0.1] rounded-2xl p-5 mb-6">
            {/* Title (optional) */}
            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Заглавие (по избор)"
              className="w-full bg-transparent text-sm font-medium text-white/80 placeholder:text-white/20 focus:outline-none mb-3"
            />

            {/* Content */}
            <textarea
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              placeholder="Напиши бележка..."
              rows={4}
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white/70 placeholder:text-white/20 focus:border-amber-400/30 focus:outline-none resize-none"
            />

            {/* Options row */}
            <div className="flex flex-wrap items-center gap-3 mt-4">
              {/* Priority */}
              <div className="flex gap-1">
                {(Object.entries(PRIORITY_CONFIG) as [string, typeof PRIORITY_CONFIG.urgent][]).map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => setNewPriority(key as 'urgent' | 'normal' | 'info')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-colors ${
                      newPriority === key ? cfg.badge + ' border-current/20' : 'text-white/30 border-white/[0.06] hover:text-white/50'
                    }`}
                  >
                    {cfg.label}
                  </button>
                ))}
              </div>

              {/* Pin toggle */}
              <button
                onClick={() => setNewPinned(!newPinned)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-colors ${
                  newPinned ? 'bg-amber-500/20 text-amber-400 border-amber-500/20' : 'text-white/30 border-white/[0.06] hover:text-white/50'
                }`}
              >
                📌 {newPinned ? 'Закачена' : 'Закачи'}
              </button>

              {/* Expiry */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-white/30">Изтича:</span>
                <input
                  type="date"
                  value={newExpiresAt}
                  onChange={e => setNewExpiresAt(e.target.value)}
                  className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1 text-[10px] text-white/50 focus:border-amber-400/30 focus:outline-none"
                />
              </div>
            </div>

            {/* Visibility — admin only */}
            {userRole === 'admin' && (
              <div className="flex items-center gap-2 mt-3">
                <span className="text-[10px] text-white/30">Видима за:</span>
                {['admin', 'receptionist', 'instructor'].map(role => (
                  <button
                    key={role}
                    onClick={() => toggleVisibility(role)}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      newVisibleTo.includes(role)
                        ? 'bg-white/[0.08] text-white/60'
                        : 'text-white/20 hover:text-white/40'
                    }`}
                  >
                    {{ admin: 'Админ', receptionist: 'Рецепция', instructor: 'Инструктори' }[role]}
                  </button>
                ))}
              </div>
            )}

            {/* Submit */}
            <div className="flex justify-end mt-4">
              <button
                onClick={handleCreate}
                disabled={saving || !newContent.trim()}
                className="px-5 py-2 rounded-xl text-xs font-medium bg-amber-400/10 text-amber-400 border border-amber-400/20 hover:bg-amber-400/20 transition-colors disabled:opacity-30"
              >
                {saving ? 'Запазвам...' : 'Публикувай'}
              </button>
            </div>
          </div>
        )}

        {/* ══════ Loading ══════ */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-5 h-5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-white/20 text-3xl mb-3">📝</div>
            <div className="text-white/30 text-sm">Няма бележки</div>
            <div className="text-white/15 text-xs mt-1">Натисни &quot;+ Нова бележка&quot; за да започнеш</div>
          </div>
        ) : (
          <>
            {/* ══════ Pinned notes ══════ */}
            {pinnedNotes.length > 0 && (
              <div className="mb-6">
                <div className="text-[10px] text-white/25 uppercase tracking-widest mb-3 flex items-center gap-2">
                  📌 Закачени
                </div>
                <div className="space-y-3">
                  {pinnedNotes.map(note => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      userRole={userRole}
                      onDelete={handleDelete}
                      onTogglePin={handleTogglePin}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ══════ Regular notes ══════ */}
            {regularNotes.length > 0 && (
              <div>
                {pinnedNotes.length > 0 && (
                  <div className="text-[10px] text-white/25 uppercase tracking-widest mb-3">
                    Последни
                  </div>
                )}
                <div className="space-y-3">
                  {regularNotes.map(note => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      userRole={userRole}
                      onDelete={handleDelete}
                      onTogglePin={handleTogglePin}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Note card component ──
function NoteCard({
  note,
  userRole,
  onDelete,
  onTogglePin,
}: {
  note: Note
  userRole: string
  onDelete: (id: string) => void
  onTogglePin: (id: string, pinned: boolean) => void
}) {
  const cfg = PRIORITY_CONFIG[note.priority] || PRIORITY_CONFIG.normal

  const roleColor: Record<string, string> = {
    admin: 'from-amber-400 to-orange-500',
    receptionist: 'from-sky-400 to-blue-500',
    instructor: 'from-emerald-400 to-green-500',
  }

  const roleLabel: Record<string, string> = {
    admin: 'Админ',
    receptionist: 'Рецепция',
    instructor: 'Инструктор',
  }

  const isAdmin = userRole === 'admin'
  const isAuthor = note.author_role === userRole

  return (
    <div className={`border rounded-xl p-4 transition-all ${cfg.color}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${roleColor[note.author_role] || 'from-gray-400 to-gray-500'} flex items-center justify-center text-[9px] font-bold text-[#0a0a0f]`}>
            {note.author_name.charAt(0)}
          </div>
          <div>
            <span className="text-xs font-medium text-white/60">{note.author_name}</span>
            <span className="text-[10px] text-white/20 ml-2">{roleLabel[note.author_role] || note.author_role}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {note.priority === 'urgent' && (
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${cfg.badge}`}>Спешно</span>
          )}
          <span className="text-[10px] text-white/20">{timeAgo(note.created_at)}</span>
        </div>
      </div>

      {/* Title */}
      {note.title && (
        <div className="text-sm font-semibold text-white/80 mb-1">{note.title}</div>
      )}

      {/* Content */}
      <div className="text-sm text-white/50 whitespace-pre-wrap leading-relaxed">{note.content}</div>

      {/* Expiry notice */}
      {note.expires_at && (
        <div className="text-[10px] text-white/20 mt-2">
          Изтича: {new Date(note.expires_at).toLocaleDateString('bg-BG', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
      )}

      {/* Actions — admin or author */}
      {(isAdmin || isAuthor) && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-white/[0.04]">
          {isAdmin && (
            <button
              onClick={() => onTogglePin(note.id, note.pinned)}
              className="text-[10px] text-white/25 hover:text-amber-400/60 transition-colors"
            >
              {note.pinned ? '📌 Откачи' : '📌 Закачи'}
            </button>
          )}
          <button
            onClick={() => onDelete(note.id)}
            className="text-[10px] text-white/25 hover:text-red-400/60 transition-colors ml-auto"
          >
            Изтрий
          </button>
        </div>
      )}
    </div>
  )
}