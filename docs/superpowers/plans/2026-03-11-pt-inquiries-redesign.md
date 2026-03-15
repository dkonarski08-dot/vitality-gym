# PT Inquiries Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename navigation label, redesign inquiries table to show all details at a glance, fix the inquiry form (multi-select time slots, goal dropdown, source field, phone validation), rename Отказан→Загубен everywhere.

**Architecture:** Four self-contained tasks — DB migration first, then navigation rename, then the two PT components (list + modal). No new files needed; all changes are in-place edits to existing components and API route.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Tailwind CSS, Supabase (mcp__supabase__*)

---

## Chunk 1: DB + Navigation

### Task 1: Add `source` column to `pt_inquiries`

**Files:**
- Modify: `app/api/pt/route.ts` (add source to add_inquiry destructure + insert)

- [ ] **Step 1: Run migration via Supabase MCP**

```sql
ALTER TABLE pt_inquiries ADD COLUMN IF NOT EXISTS source text;
```

Use `mcp__supabase__execute_sql` with the SQL above.

- [ ] **Step 2: Verify column exists**

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'pt_inquiries' AND column_name = 'source';
```

Expected: one row with `column_name = source`, `data_type = text`.

- [ ] **Step 3: Update API route — add_inquiry action**

In `app/api/pt/route.ts`, find the `add_inquiry` action (around line 315):

```typescript
// BEFORE:
const { name, phone, preferred_days, preferred_time_slot, goal, notes, created_by, assigned_to } = body
// insert: { gym_id: GYM_ID, name, phone, preferred_days, preferred_time_slot, goal, notes, ... }

// AFTER:
const { name, phone, preferred_days, preferred_time_slot, goal, notes, created_by, assigned_to, source } = body
// insert: { gym_id: GYM_ID, name, phone, preferred_days, preferred_time_slot, goal, notes, source, ... }
```

- [ ] **Step 4: Verify TypeScript builds**

```bash
cd ~/vitality-gym && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/api/pt/route.ts
git commit -m "feat(pt): add source field to pt_inquiries DB + API"
```

---

### Task 2: Rename navigation label

**Files:**
- Modify: `src/modules/common/navigation.ts` line 8

- [ ] **Step 1: Update the label**

In `src/modules/common/navigation.ts`:
```typescript
// BEFORE:
{ key: 'pt', label: 'PT Календар', icon: '💪', href: '/pt', roles: ['admin', 'receptionist', 'instructor'] },

// AFTER:
{ key: 'pt', label: 'График ПТ', icon: '💪', href: '/pt', roles: ['admin', 'receptionist', 'instructor'] },
```

- [ ] **Step 2: Verify in browser**

Start dev server (`npm run dev`), open `/pt`, confirm sidebar shows "График ПТ".

- [ ] **Step 3: Commit**

```bash
git add src/modules/common/navigation.ts
git commit -m "feat(pt): rename 'PT Календар' to 'График ПТ' in navigation"
```

---

## Chunk 2: Inquiry List Redesign

### Task 3: Redesign `PTInquiryList` — table layout + Загубен rename

**Files:**
- Modify: `app/(dashboard)/pt/components/PTInquiryList.tsx`

**Key design decisions:**
- `preferred_time_slot` is stored as comma-separated string (e.g. `"morning,afternoon"`) — split on `,` for display
- Completed rows dimmed with `opacity-50`
- Age badge shown when pending inquiry is >3 days old

- [ ] **Step 1: Update `PTInquiry` interface — add `source` field**

At the top of `PTInquiryList.tsx`, add `source` to the interface:

```typescript
export interface PTInquiry {
  id: string
  name: string
  phone: string
  preferred_days: string[] | null
  preferred_time_slot: string | null  // comma-separated: "morning", "morning,evening", etc.
  goal: string | null
  notes: string | null
  source: string | null               // ADD THIS
  status: 'pending' | 'done'
  outcome: 'won' | 'lost' | null
  lost_reason: string | null
  assigned_to: string | null
  assigned: { id: string; name: string } | null
  created_by: string | null
  created_at: string
  updated_at: string
}
```

- [ ] **Step 2: Add time slot + goal display helpers (inside component, before return)**

```typescript
const TIME_SLOT_LABELS: Record<string, string> = {
  morning: '🌅 Сутрин',
  afternoon: '☀️ Обяд',
  evening: '🌙 Вечер',
}

const GOAL_LABELS: Record<string, string> = {
  weight_loss: '⚖️ Отслабване',
  muscle: '💪 Мускулна маса',
  cardio: '🏃 Кардио',
  rehab: '🩺 Рехабилитация',
  general: '✨ Обща форма',
}

function getTimeSlotChips(slot: string | null): string[] {
  if (!slot) return []
  return slot.split(',').map(s => s.trim()).filter(Boolean)
}

function getDaysOrAll(days: string[] | null): { isAll: boolean; days: string[] } {
  if (!days || days.length === 0) return { isAll: false, days: [] }
  if (days.length >= 7) return { isAll: true, days: [] }
  return { isAll: false, days }
}

function getAgeDays(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24))
}
```

- [ ] **Step 3: Replace the entire component return with new table layout**

Replace everything from `return (` to closing `</div>` with:

```tsx
return (
  <div className="space-y-4">
    {/* Stats pills */}
    <div className="flex flex-wrap gap-2">
      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs bg-white/5 border border-white/10">
        <span className="font-semibold text-amber-400">{pendingCount}</span>
        <span className="text-white/60">активни</span>
      </span>
      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs bg-white/5 border border-white/10">
        <span className="font-semibold text-emerald-400">{wonCount}</span>
        <span className="text-white/60">спечелени</span>
      </span>
      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs bg-white/5 border border-white/10">
        <span className="font-semibold text-red-400">{lostCount}</span>
        <span className="text-white/60">загубени</span>
      </span>
      {totalDone > 0 && (
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs bg-white/5 border border-white/10">
          <span className="font-semibold text-white">{conversionPct}%</span>
          <span className="text-white/60">конверсия</span>
        </span>
      )}
    </div>

    {/* Filter tabs */}
    <div className="flex gap-1 p-1 w-fit bg-white/[0.03] border border-white/[0.07] rounded-lg">
      {(['all', 'pending', 'done'] as const).map(f => (
        <button
          key={f}
          onClick={() => setFilter(f)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            filter === f ? 'bg-amber-400/15 text-amber-400' : 'text-white/40 hover:text-white/70'
          }`}
        >
          {f === 'all' ? 'Всички' : f === 'pending' ? 'Активни' : 'Приключени'}
        </button>
      ))}
    </div>

    {/* Table */}
    <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl overflow-hidden">
      <table className="w-full border-collapse">
        <thead className="bg-white/[0.04]">
          <tr>
            {['Клиент', 'Дни', 'Час', 'Цел', 'Инструктор', 'Статус', 'Действия'].map(h => (
              <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-white/40 border-b border-white/[0.06]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-white/30 text-sm">
                Няма запитвания
              </td>
            </tr>
          )}
          {filtered.map(inq => {
            const isDone = inq.status === 'done'
            const ageDays = getAgeDays(inq.created_at)
            const timeChips = getTimeSlotChips(inq.preferred_time_slot)
            const { isAll, days } = getDaysOrAll(inq.preferred_days)
            const allSlots = timeChips.length >= 3
            const instructor = instructors.find(i => i.id === inq.assigned_to)
            const initials = instructor ? instructor.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() : null

            return (
              <tr key={inq.id} className={`border-b border-white/[0.05] last:border-0 hover:bg-white/[0.02] transition-colors ${isDone ? 'opacity-50' : ''}`}>
                {/* Client */}
                <td className="px-4 py-3 align-top">
                  <div className="font-semibold text-white text-sm">{inq.name}</div>
                  <div className="text-xs text-white/40 mt-0.5">{inq.phone}</div>
                  {inq.notes && <div className="text-[11px] text-white/30 italic mt-1 max-w-[180px] truncate">{inq.notes}</div>}
                </td>
                {/* Days */}
                <td className="px-4 py-3 align-top">
                  {isAll ? (
                    <span className="px-1.5 py-0.5 rounded text-[11px] bg-white/[0.06] border border-white/[0.12] text-white/45">Всеки ден</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {days.map(d => (
                        <span key={d} className="px-1.5 py-0.5 rounded text-[11px] bg-amber-400/10 border border-amber-400/25 text-amber-400 font-medium">{d}</span>
                      ))}
                    </div>
                  )}
                </td>
                {/* Time */}
                <td className="px-4 py-3 align-top">
                  {allSlots ? (
                    <span className="px-2 py-0.5 rounded text-[11px] bg-white/[0.05] border border-white/[0.12] text-white/45">🕐 Гъвкав</span>
                  ) : timeChips.length === 0 ? (
                    <span className="text-white/25 text-xs">—</span>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {timeChips.map(t => (
                        <span key={t} className="px-2 py-0.5 rounded text-[11px] bg-sky-400/10 border border-sky-400/20 text-sky-400 font-medium whitespace-nowrap">
                          {TIME_SLOT_LABELS[t] ?? t}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                {/* Goal */}
                <td className="px-4 py-3 align-top">
                  {inq.goal ? (
                    <span className="px-2 py-0.5 rounded text-[11px] bg-violet-400/10 border border-violet-400/20 text-violet-400">
                      {GOAL_LABELS[inq.goal] ?? inq.goal}
                    </span>
                  ) : <span className="text-white/25 text-xs">—</span>}
                </td>
                {/* Instructor */}
                <td className="px-4 py-3 align-top">
                  {instructor ? (
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-emerald-400/15 border border-emerald-400/30 flex items-center justify-center text-[10px] font-bold text-emerald-400 shrink-0">
                        {initials}
                      </div>
                      <span className="text-xs text-white/75">{instructor.name}</span>
                    </div>
                  ) : <span className="text-white/25 text-xs">—</span>}
                </td>
                {/* Status */}
                <td className="px-4 py-3 align-top">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      isDone
                        ? inq.outcome === 'won' ? 'bg-emerald-400' : 'bg-white/30'
                        : 'bg-amber-400 animate-pulse'
                    }`} />
                    <span className={`text-xs ${
                      isDone
                        ? inq.outcome === 'won' ? 'text-emerald-400' : 'text-white/40'
                        : 'text-amber-400'
                    }`}>
                      {isDone
                        ? inq.outcome === 'won' ? 'Спечелен' : 'Загубен'
                        : 'Активно'}
                    </span>
                  </div>
                  {!isDone && ageDays > 3 && (
                    <span className="mt-1 flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] bg-red-400/10 border border-red-400/20 text-red-400 w-fit">
                      ⏰ {ageDays} дни
                    </span>
                  )}
                </td>
                {/* Actions */}
                <td className="px-4 py-3 align-top">
                  {!isDone ? (
                    <div className="flex gap-1.5 flex-wrap">
                      <button
                        onClick={() => handleOutcome(inq.id, 'won')}
                        className="px-2.5 py-1 rounded-md text-xs bg-emerald-400/15 border border-emerald-400/30 text-emerald-400 hover:bg-emerald-400/25 transition-colors"
                      >
                        ✓ Спечелен
                      </button>
                      <button
                        onClick={() => handleOutcome(inq.id, 'lost')}
                        className="px-2.5 py-1 rounded-md text-xs bg-red-400/10 border border-red-400/25 text-red-400 hover:bg-red-400/20 transition-colors"
                      >
                        ✗ Загубен
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleReopen(inq.id)}
                        className="px-2.5 py-1 rounded-md text-xs bg-white/5 border border-white/10 text-white/50 hover:text-white/80 transition-colors"
                      >
                        Върни
                      </button>
                      <button
                        onClick={() => handleDelete(inq.id)}
                        className="px-2.5 py-1 rounded-md text-xs bg-red-400/10 border border-red-400/20 text-red-400/70 hover:text-red-400 transition-colors"
                      >
                        Изтрий
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  </div>
)
```

- [ ] **Step 4: Update state + derived values at the top of the component**

Replace/update the existing state and filter logic:

```typescript
const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all')

const filtered = inquiries.filter(i =>
  filter === 'all' ? true : i.status === filter
)

const pendingCount = inquiries.filter(i => i.status === 'pending').length
const wonCount = inquiries.filter(i => i.outcome === 'won').length
const lostCount = inquiries.filter(i => i.outcome === 'lost').length
const totalDone = wonCount + lostCount
const conversionPct = totalDone > 0 ? Math.round((wonCount / totalDone) * 100) : 0
```

- [ ] **Step 5: Ensure handler functions exist in component**

Keep or create these handlers (they likely exist already — adapt as needed):

```typescript
async function handleOutcome(id: string, outcome: 'won' | 'lost') {
  await fetch('/api/pt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'update_inquiry', inquiry_id: id, status: 'done', outcome }),
  })
  onRefresh()
}

async function handleReopen(id: string) {
  await fetch('/api/pt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'update_inquiry', inquiry_id: id, status: 'pending', outcome: null }),
  })
  onRefresh()
}

async function handleDelete(id: string) {
  if (!confirm('Изтриване на запитването?')) return
  await fetch('/api/pt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'delete_inquiry', inquiry_id: id }),
  })
  onRefresh()
}
```

- [ ] **Step 6: Verify TypeScript builds**

```bash
cd ~/vitality-gym && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add "app/(dashboard)/pt/components/PTInquiryList.tsx"
git commit -m "feat(pt): redesign inquiries table — flat layout, chips, Загубен rename"
```

---

## Chunk 3: Inquiry Form Redesign

### Task 4: Redesign `PTInquiryModal` — multi-select time, goal dropdown, source, phone validation

**Files:**
- Modify: `app/(dashboard)/pt/components/PTInquiryModal.tsx`

**Key decisions:**
- Time slots stored as comma-separated string: `"morning"`, `"morning,evening"`, `"morning,afternoon,evening"` → maps to existing `preferred_time_slot text` column (no migration needed)
- Goal stored as key string: `"weight_loss"`, `"muscle"`, `"cardio"`, `"rehab"`, `"general"`
- BG phone validation: strip spaces/dashes, accept `08XXXXXXXX` (10 digits) or `+3598XXXXXXXX` (13 chars with +)

- [ ] **Step 1: Add constants at top of file (after imports)**

```typescript
const TIME_SLOTS = [
  { key: 'morning',   label: 'Сутрин',  range: '8:00 – 12:00', emoji: '🌅' },
  { key: 'afternoon', label: 'Обяд',    range: '12:00 – 16:00', emoji: '☀️' },
  { key: 'evening',   label: 'Вечер',   range: '16:00 – 20:00', emoji: '🌙' },
]

const GOALS = [
  { key: 'weight_loss', label: '⚖️ Отслабване и стройност' },
  { key: 'muscle',      label: '💪 Мускулна маса и сила' },
  { key: 'cardio',      label: '🏃 Кардио и издръжливост' },
  { key: 'rehab',       label: '🩺 Рехабилитация и здраве' },
  { key: 'general',     label: '✨ Обща форма и тонус' },
]

const SOURCES = [
  { key: 'facebook',   label: '📘 Фейсбук' },
  { key: 'instagram',  label: '📸 Инстаграм' },
  { key: 'google',     label: '🔍 Гугъл' },
  { key: 'friend',     label: '👥 Приятел' },
  { key: 'nearby',     label: '📍 Живея наблизо' },
]

function validateBGPhone(phone: string): boolean {
  const clean = phone.replace(/[\s\-().]/g, '')
  // 08XXXXXXXX — 10 digits starting with 08
  if (/^08\d{8}$/.test(clean)) return true
  // +3598XXXXXXXX — +359 then 9 digits starting with 8
  if (/^\+3598\d{8}$/.test(clean)) return true
  return false
}
```

- [ ] **Step 2: Update form state to handle multi-select time slots, goal key, and source**

Find where form state is initialized. Change `preferred_time_slot` to an array, add `goal` as key, add `source`:

```typescript
// Form state — locate existing useState calls and update:
const [selectedTimes, setSelectedTimes] = useState<string[]>([])   // replaces single preferred_time_slot
const [goal, setGoal] = useState('')
const [source, setSource] = useState('')
const [phoneError, setPhoneError] = useState('')

// Toggle time slot helper:
function toggleTime(key: string) {
  setSelectedTimes(prev =>
    prev.includes(key) ? prev.filter(t => t !== key) : [...prev, key]
  )
}
```

- [ ] **Step 3: Add phone validation on blur + submit guard**

On the phone `<input>`, add:

```tsx
<input
  type="text"
  value={phone}
  onChange={e => { setPhone(e.target.value); setPhoneError('') }}
  onBlur={() => {
    if (phone && !validateBGPhone(phone)) {
      setPhoneError('Невалиден БГ номер (напр. 0888123456 или +359888123456)')
    }
  }}
  placeholder="0888 123 456"
  className={`... ${phoneError ? 'border-red-400/60' : 'border-white/10'}`}
/>
{phoneError && <p className="text-xs text-red-400 mt-1">{phoneError}</p>}
```

In the submit handler, add guard:

```typescript
if (phone && !validateBGPhone(phone)) {
  setPhoneError('Невалиден БГ номер')
  return
}
```

- [ ] **Step 4: Replace time slot UI (single select → multi-select cards)**

Find the existing `preferred_time_slot` radio/button group and replace with:

```tsx
<div>
  <label className="text-xs text-white/55 mb-2 block">
    Предпочитан час
    <span className="text-white/30 ml-1">— избери един или повече</span>
  </label>
  <div className="flex flex-col gap-2">
    {TIME_SLOTS.map(ts => {
      const active = selectedTimes.includes(ts.key)
      return (
        <button
          key={ts.key}
          type="button"
          onClick={() => toggleTime(ts.key)}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
            active
              ? 'bg-sky-400/10 border-sky-400/35'
              : 'bg-white/[0.04] border-white/10 hover:border-white/20'
          }`}
        >
          <span className="text-lg">{ts.emoji}</span>
          <div className="flex-1">
            <div className={`text-sm font-medium ${active ? 'text-white' : 'text-white/75'}`}>{ts.label}</div>
            <div className="text-xs text-white/35">{ts.range}</div>
          </div>
          <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-[11px] font-bold transition-opacity ${
            active ? 'bg-sky-400/20 border-sky-400/40 text-sky-400 opacity-100' : 'opacity-0'
          }`}>✓</div>
        </button>
      )
    })}
  </div>
  <p className="text-[11px] text-white/30 mt-2">ℹ️ Можеш да избереш повече от един</p>
</div>
```

- [ ] **Step 5: Replace goal text input with dropdown**

Find the existing `goal` text input and replace with:

```tsx
<div>
  <label className="text-xs text-white/55 mb-1.5 block">Фитнес цел</label>
  <div className="relative">
    <select
      value={goal}
      onChange={e => setGoal(e.target.value)}
      className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-sm text-white appearance-none focus:outline-none focus:border-amber-400/50"
    >
      <option value="">— избери цел —</option>
      {GOALS.map(g => (
        <option key={g.key} value={g.key}>{g.label}</option>
      ))}
    </select>
    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none">▾</span>
  </div>
  {goal && (
    <div className="mt-1.5 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-violet-400/10 border border-violet-400/20 text-violet-400 text-xs">
      {GOALS.find(g => g.key === goal)?.label}
    </div>
  )}
</div>
```

- [ ] **Step 6: Add "Откъде разбра за нас" dropdown (after goal, before notes)**

```tsx
<div>
  <label className="text-xs text-white/55 mb-1.5 block">Откъде разбра за нас</label>
  <div className="relative">
    <select
      value={source}
      onChange={e => setSource(e.target.value)}
      className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-sm text-white appearance-none focus:outline-none focus:border-amber-400/50"
    >
      <option value="">— избери —</option>
      {SOURCES.map(s => (
        <option key={s.key} value={s.key}>{s.label}</option>
      ))}
    </select>
    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none">▾</span>
  </div>
</div>
```

- [ ] **Step 7: Update submit handler to send new fields**

In the submit/save function, update the body sent to `/api/pt`:

```typescript
body: JSON.stringify({
  action: 'add_inquiry',
  name,
  phone,
  preferred_days: selectedDays,           // existing
  preferred_time_slot: selectedTimes.join(','),  // NEW: comma-separated
  goal,                                    // key string
  source,                                  // NEW
  notes,
  created_by: userName,
  assigned_to: assignedTo || null,
})
```

- [ ] **Step 8: Verify TypeScript builds**

```bash
cd ~/vitality-gym && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 9: Smoke test in browser**

1. Open `/pt` → tab Запитвания
2. Click "+ Ново запитване"
3. Verify: time slots are 3 tappable cards, multi-select works
4. Verify: Фитнес цел is a dropdown with 5 options + purple preview
5. Verify: Откъде разбра dropdown shows 5 sources
6. Type invalid phone (e.g. `123`) → click next field → error appears
7. Type valid phone (`0888123456`) → error clears
8. Submit → inquiry appears in table with correct chips

- [ ] **Step 10: Commit**

```bash
git add "app/(dashboard)/pt/components/PTInquiryModal.tsx"
git commit -m "feat(pt): redesign inquiry form — multi-select time, goal dropdown, source, phone validation"
```
