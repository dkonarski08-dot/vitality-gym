# Users Module Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin-only „Потребители" page that replaces the hardcoded `USERS` array in `login/page.tsx` with a dynamic `app_users` table in Supabase.

**Architecture:** New `app_users` table stores login accounts separately from the HR `employees` table, linked via nullable `employee_id` FK. All PIN hashing uses `bcryptjs` consistently (seed script + API routes). The login page becomes async (fetch on mount) and delegates PIN verification to a new `/api/auth/login` route. The `employees.pin_code` column is nullified only AFTER seed is confirmed to avoid data-loss if seed fails.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Supabase (supabaseAdmin service role), Tailwind CSS, bcryptjs

**Spec:** `docs/superpowers/specs/2026-03-13-users-module.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `migrations/005_app_users.sql` | Create | DDL only — creates `app_users` table (no seed, no pin_code nullification) |
| `scripts/seed-app-users.ts` | Create | One-time seed with bcryptjs hashes |
| `migrations/005b_nullify_pin_codes.sql` | Create | Nullifies `employees.pin_code` — run AFTER seed is confirmed |
| `src/types/database.ts` | Modify | Add `AppUser` interface (no `pin_hash` — never sent to client) |
| `src/modules/common/navigation.ts` | Modify | Add Потребители nav item after `reviews`, before `settings` |
| `app/api/auth/users/route.ts` | Create | GET active user list `{ id, name, role }` for login page |
| `app/api/auth/login/route.ts` | Create | POST verify PIN with bcryptjs.compare, return session |
| `app/api/users/route.ts` | Create | GET all users (explicit column select — no `pin_hash`), POST create |
| `app/api/users/[id]/route.ts` | Create | PUT edit + PATCH toggle active — both with last-admin guard |
| `app/(auth)/login/page.tsx` | Modify | Async fetch, loading/error states, API-based login |
| `app/(dashboard)/users/page.tsx` | Create | Users list page (admin-only via useSession role check) |
| `app/(dashboard)/users/components/UserCard.tsx` | Create | Single user card with Edit + Deactivate/Activate |
| `app/(dashboard)/users/components/UserModal.tsx` | Create | Add/edit modal with 4-cell PIN input |

---

## Chunk 1: Foundation — Dependencies, DB, Types, Navigation

### Task 1: Install bcryptjs

**Files:** `package.json` (via npm)

- [ ] **Step 1: Install**

```bash
cd ~/vitality-gym && npm install bcryptjs && npm install --save-dev @types/bcryptjs
```

- [ ] **Step 2: Verify**

```bash
node -e "const b = require('bcryptjs'); console.log(b.hashSync('1234', 10))"
```

Expected: a string starting with `$2b$10$`

---

### Task 2: DB Migration (DDL only)

**Files:** Create `migrations/005_app_users.sql`

- [ ] **Step 1: Write the file**

```sql
-- migrations/005_app_users.sql
-- Login accounts table — separate from employees (HR/payroll)
-- NOTE: Does NOT nullify employees.pin_code — run seed first, then 005b

CREATE TABLE app_users (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id       uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  name         text NOT NULL,
  role         text NOT NULL CHECK (role IN ('admin', 'receptionist', 'instructor')),
  pin_hash     text NOT NULL,
  employee_id  uuid REFERENCES employees(id) ON DELETE SET NULL,
  phone        text,
  birth_date   date,
  hired_at     date,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gym_id, name)
);
```

- [ ] **Step 2: Run via Supabase MCP**

Execute the SQL above against Supabase project `enyyjoacjdkaygfpbimf`.

- [ ] **Step 3: Verify table exists**

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'app_users' ORDER BY ordinal_position;
```

Expected: 13 rows — id through updated_at.

---

### Task 3: Seed Script

**Files:** Create `scripts/seed-app-users.ts`

- [ ] **Step 1: Write the seed script**

```ts
// scripts/seed-app-users.ts
// Run once after migration: npx tsx scripts/seed-app-users.ts
import bcryptjs from 'bcryptjs'          // default import (esModuleInterop=true)
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const GYM_ID = '00000000-0000-0000-0000-000000000001'

async function seed() {
  const { data: employees } = await supabase
    .from('employees')
    .select('id, name')

  const findEmployee = (namePart: string): string | null =>
    employees?.find(e =>
      (e.name as string).toLowerCase().includes(namePart.toLowerCase())
    )?.id ?? null

  const users = [
    { name: 'Dimitar',    role: 'admin',        pin: '1234', employeeName: null },
    { name: 'Рецепция',   role: 'receptionist', pin: '0000', employeeName: null },
    { name: 'Петър GYM',  role: 'instructor',   pin: '1111', employeeName: 'Петър' },
    { name: 'Емануела',   role: 'instructor',   pin: '2222', employeeName: 'Емануела' },
  ]

  for (const u of users) {
    const pin_hash = await bcryptjs.hash(u.pin, 10)
    const employee_id = u.employeeName ? findEmployee(u.employeeName) : null

    const { error } = await supabase.from('app_users').insert({
      gym_id: GYM_ID,
      name: u.name,
      role: u.role,
      pin_hash,
      employee_id,
    })

    if (error) {
      console.error(`✗ ${u.name}: ${error.message}`)
    } else {
      console.log(`✓ ${u.name} (${u.role})${employee_id ? ' → linked employee' : ''}`)
    }
  }
}

seed().then(() => {
  console.log('\nDone. Now run migration 005b to nullify employees.pin_code.')
  process.exit(0)
}).catch(err => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 2: Install tsx if needed, then run seed**

```bash
cd ~/vitality-gym && npx tsx scripts/seed-app-users.ts
```

If `tsx` is not found: `npm install --save-dev tsx` then retry.

Expected output:
```
✓ Dimitar (admin)
✓ Рецепция (receptionist)
✓ Петър GYM (instructor) → linked employee
✓ Емануела (instructor) → linked employee
Done. Now run migration 005b to nullify employees.pin_code.
```

- [ ] **Step 3: Verify seed data in DB**

```sql
SELECT name, role, is_active, employee_id IS NOT NULL as has_employee,
       LEFT(pin_hash, 7) as hash_prefix
FROM app_users ORDER BY name;
```

Expected: 4 rows, all `is_active=true`, `hash_prefix='$2b$10$'`.

---

### Task 4: Nullify employees.pin_code (run only after seed succeeds)

**Files:** Create `migrations/005b_nullify_pin_codes.sql`

- [ ] **Step 1: Write the file**

```sql
-- migrations/005b_nullify_pin_codes.sql
-- Run ONLY after seed-app-users.ts has been confirmed to work.
-- Removes plaintext PINs from employees table (no longer used for login).
UPDATE employees SET pin_code = NULL;
```

- [ ] **Step 2: Confirm seed is working first**

Manually test login at `http://localhost:3000/login` with one user to confirm the seed worked. Only then proceed.

- [ ] **Step 3: Run via Supabase MCP**

Execute `UPDATE employees SET pin_code = NULL;` against Supabase project.

---

### Task 5: AppUser type + Navigation

**Files:**
- Modify: `src/types/database.ts`
- Modify: `src/modules/common/navigation.ts`

- [ ] **Step 1: Add AppUser to `src/types/database.ts`** — append after the `NavItem` interface

```ts
// Login account — separate from StaffMember (HR/payroll)
// pin_hash is intentionally excluded — never sent to client
// API routes select columns explicitly to enforce this
export interface AppUser {
  id: string
  gym_id: string
  name: string
  role: 'admin' | 'receptionist' | 'instructor'
  employee_id: string | null
  phone: string | null
  birth_date: string | null   // ISO date: YYYY-MM-DD
  hired_at: string | null     // ISO date: YYYY-MM-DD
  is_active: boolean
  created_at: string
  updated_at: string
}
```

- [ ] **Step 2: Add nav item to `src/modules/common/navigation.ts`**

In the `NAV_ITEMS` array, find the `reviews` entry and insert after it, before `settings`:

```ts
{ key: 'users', label: 'Потребители', icon: '👤', href: '/users', roles: ['admin'] },
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
. "$HOME/.nvm/nvm.sh" && cd ~/vitality-gym && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit Chunk 1**

```bash
git add migrations/ scripts/ src/types/database.ts src/modules/common/navigation.ts package.json package-lock.json
git commit -m "feat(users): foundation — migration, seed, AppUser type, nav item"
```

---

## Chunk 2: API Routes

### Task 6: GET /api/auth/users

**Files:** Create `app/api/auth/users/route.ts`

- [ ] **Step 1: Create the route**

```ts
// app/api/auth/users/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { GYM_ID } from '@/lib/constants'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('app_users')
      .select('id, name, role')          // pin_hash intentionally excluded
      .eq('gym_id', GYM_ID)
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) throw error
    return NextResponse.json({ users: data ?? [] })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Test**

```bash
curl -s http://localhost:3000/api/auth/users | jq .
```

Expected: `{ "users": [ { "id": "...", "name": "Dimitar", "role": "admin" }, ... ] }` — 4 entries, no `pin_hash`.

---

### Task 7: POST /api/auth/login

**Files:** Create `app/api/auth/login/route.ts`

- [ ] **Step 1: Create the route**

```ts
// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server'
import bcryptjs from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { GYM_ID } from '@/lib/constants'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { name?: string; pin?: string }
    const { name, pin } = body

    if (!name || !pin) {
      return NextResponse.json({ error: 'Грешен PIN код' }, { status: 401 })
    }

    const { data: user, error } = await supabaseAdmin
      .from('app_users')
      .select('name, role, employee_id, pin_hash, is_active')
      .eq('gym_id', GYM_ID)
      .eq('name', name)          // exact case match — same as user clicking their card
      .single()

    if (error || !user) {
      // Don't reveal whether the name exists
      return NextResponse.json({ error: 'Грешен PIN код' }, { status: 401 })
    }

    // Check PIN first (bcryptjs.compare — NOT pgcrypto SQL)
    const isValid = await bcryptjs.compare(pin, user.pin_hash)
    if (!isValid) {
      return NextResponse.json({ error: 'Грешен PIN код' }, { status: 401 })
    }

    // Then check active status — intentionally different error (UX: user knows account exists)
    if (!user.is_active) {
      return NextResponse.json({ error: 'Акаунтът е деактивиран' }, { status: 403 })
    }

    return NextResponse.json({
      name: user.name,
      role: user.role,
      employeeId: user.employee_id,   // null for admin accounts without employee record
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Test**

```bash
# Valid login
curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"name":"Dimitar","pin":"1234"}' | jq .
# Expected: { "name": "Dimitar", "role": "admin", "employeeId": null }

# Wrong PIN
curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"name":"Dimitar","pin":"9999"}' | jq .
# Expected: { "error": "Грешен PIN код" } — HTTP 401
```

---

### Task 8: GET + POST /api/users

**Files:** Create `app/api/users/route.ts`

- [ ] **Step 1: Create the route**

```ts
// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server'
import bcryptjs from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { GYM_ID } from '@/lib/constants'

// Explicit column list — pin_hash NEVER returned to client
const USER_COLUMNS = 'id, gym_id, name, role, employee_id, phone, birth_date, hired_at, is_active, created_at, updated_at'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('app_users')
      .select(USER_COLUMNS)
      .eq('gym_id', GYM_ID)
      .order('is_active', { ascending: false })
      .order('name', { ascending: true })

    if (error) throw error
    return NextResponse.json({ users: data ?? [] })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      name: string
      role: string
      pin: string
      phone?: string
      birth_date?: string
      hired_at?: string
      employee_id?: string
    }

    const { name, role, pin, phone, birth_date, hired_at, employee_id } = body

    if (!name?.trim() || !role || !pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: 'Невалидни данни' }, { status: 400 })
    }

    const pin_hash = await bcryptjs.hash(pin, 10)

    const { data, error } = await supabaseAdmin
      .from('app_users')
      .insert({
        gym_id: GYM_ID,
        name: name.trim(),
        role,
        pin_hash,
        phone: phone?.trim() || null,
        birth_date: birth_date || null,
        hired_at: hired_at || null,
        employee_id: employee_id || null,
        updated_at: new Date().toISOString(),
      })
      .select(USER_COLUMNS)
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Потребител с това име вече съществува' },
          { status: 409 }
        )
      }
      throw error
    }

    return NextResponse.json({ user: data }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
```

---

### Task 9: PUT + PATCH /api/users/[id]

**Files:** Create `app/api/users/[id]/route.ts`

- [ ] **Step 1: Create the route**

The `getActiveAdminCountExcluding` helper lives in this same file — it is NOT a shared utility.

```ts
// app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import bcryptjs from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { GYM_ID } from '@/lib/constants'

const USER_COLUMNS = 'id, gym_id, name, role, employee_id, phone, birth_date, hired_at, is_active, created_at, updated_at'

// Helper: count active admins EXCLUDING the given user id
// Used by both PUT and PATCH last-admin guards
async function getActiveAdminCountExcluding(id: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from('app_users')
    .select('id', { count: 'exact', head: true })
    .eq('gym_id', GYM_ID)
    .eq('role', 'admin')
    .eq('is_active', true)
    .neq('id', id)
  return count ?? 0
}

// PUT /api/users/[id] — full profile update (name, role, optional PIN, profile fields)
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const body = await req.json() as {
      name: string
      role: string
      pin?: string
      phone?: string
      birth_date?: string
      hired_at?: string
      employee_id?: string
    }
    const { name, role, pin, phone, birth_date, hired_at, employee_id } = body

    // Last-admin guard: block demoting the only admin
    const { data: current } = await supabaseAdmin
      .from('app_users')
      .select('role')
      .eq('id', id)
      .single()

    if (current?.role === 'admin' && role !== 'admin') {
      const otherAdmins = await getActiveAdminCountExcluding(id)
      if (otherAdmins === 0) {
        return NextResponse.json(
          { error: 'Не можеш да смениш ролята на единствения администратор' },
          { status: 400 }
        )
      }
    }

    const updates: Record<string, unknown> = {
      name: name.trim(),
      role,
      phone: phone?.trim() || null,
      birth_date: birth_date || null,
      hired_at: hired_at || null,
      employee_id: employee_id || null,
      updated_at: new Date().toISOString(),
    }

    // Only update PIN if a new 4-digit PIN was provided
    if (pin && pin.length === 4 && /^\d{4}$/.test(pin)) {
      updates.pin_hash = await bcryptjs.hash(pin, 10)
    }

    const { data, error } = await supabaseAdmin
      .from('app_users')
      .update(updates)
      .eq('id', id)
      .eq('gym_id', GYM_ID)
      .select(USER_COLUMNS)
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Потребител с това име вече съществува' },
          { status: 409 }
        )
      }
      throw error
    }

    return NextResponse.json({ user: data })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}

// PATCH /api/users/[id] — toggle is_active only
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const { is_active } = await req.json() as { is_active: boolean }

    // Last-admin guard: block deactivating the only admin
    if (!is_active) {
      const { data: current } = await supabaseAdmin
        .from('app_users')
        .select('role')
        .eq('id', id)
        .single()

      if (current?.role === 'admin') {
        const otherAdmins = await getActiveAdminCountExcluding(id)
        if (otherAdmins === 0) {
          return NextResponse.json(
            { error: 'Не можеш да деактивираш единствения администратор' },
            { status: 400 }
          )
        }
      }
    }

    const { data, error } = await supabaseAdmin
      .from('app_users')
      .update({ is_active, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('gym_id', GYM_ID)
      .select(USER_COLUMNS)
      .single()

    if (error) throw error
    return NextResponse.json({ user: data })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
. "$HOME/.nvm/nvm.sh" && cd ~/vitality-gym && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit Chunk 2**

```bash
git add app/api/auth/ app/api/users/
git commit -m "feat(users): API routes — auth/users, auth/login, users CRUD with last-admin guard"
```

---

## Chunk 3: UI Components

### Task 10: UserCard component

**Files:** Create `app/(dashboard)/users/components/UserCard.tsx`

- [ ] **Step 1: Create the file**

```tsx
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
```

---

### Task 11: UserModal component

**Files:** Create `app/(dashboard)/users/components/UserModal.tsx`

- [ ] **Step 1: Create the file**

```tsx
// app/(dashboard)/users/components/UserModal.tsx
'use client'
import { useState } from 'react'
import { AppUser } from '@/src/types/database'

interface UserModalProps {
  user?: AppUser
  onSave: () => void
  onClose: () => void
}

type RoleValue = 'admin' | 'receptionist' | 'instructor'

const ROLES: { value: RoleValue; label: string; icon: string; selectedClass: string }[] = [
  { value: 'admin',        label: 'Админ',      icon: '👑', selectedClass: 'border-amber-400 bg-amber-400/[0.08]' },
  { value: 'receptionist', label: 'Рецепция',   icon: '🖥',  selectedClass: 'border-sky-400 bg-sky-400/[0.08]' },
  { value: 'instructor',   label: 'Инструктор', icon: '💪', selectedClass: 'border-emerald-400 bg-emerald-400/[0.08]' },
]

export default function UserModal({ user, onSave, onClose }: UserModalProps) {
  const isEdit = !!user

  const [role, setRole] = useState<RoleValue>(user?.role ?? 'receptionist')
  const [name, setName] = useState(user?.name ?? '')
  const [pin, setPin] = useState('')
  // pinDirty: in edit mode, true once user types the first digit (clears placeholder)
  const [pinDirty, setPinDirty] = useState(false)
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [birthDate, setBirthDate] = useState(user?.birth_date ?? '')
  const [hiredAt, setHiredAt] = useState(user?.hired_at ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handlePinDigit = (digit: string) => {
    if (pin.length >= 4) return
    if (isEdit && !pinDirty) {
      // First digit in edit mode: clear the placeholder and start fresh
      setPin(digit)
      setPinDirty(true)
    } else {
      setPin(prev => prev + digit)
    }
  }

  const handlePinDelete = () => {
    if (isEdit && !pinDirty) return   // nothing to delete when showing placeholder
    setPin(prev => prev.slice(0, -1))
    if (pin.length <= 1) setPinDirty(false)
  }

  const validate = (): string => {
    if (!role) return 'Изберете роля'
    if (!name.trim()) return 'Въведете потребителско име'
    if (!isEdit && pin.length !== 4) return 'PIN кодът трябва да е 4 цифри'
    if (pin.length > 0 && pin.length !== 4) return 'PIN кодът трябва да е 4 цифри'
    return ''
  }

  const handleSave = async () => {
    const validationError = validate()
    if (validationError) { setError(validationError); return }
    setSaving(true)
    setError('')
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        role,
        phone: phone.trim() || null,
        birth_date: birthDate || null,
        hired_at: hiredAt || null,
      }
      // Only send PIN if user entered a new one (or it's a new user)
      if (!isEdit || (pinDirty && pin.length === 4)) {
        body.pin = pin
      }
      const url = isEdit ? `/api/users/${user!.id}` : '/api/users'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Грешка при запазване'); return }
      onSave()
    } catch {
      setError('Мрежова грешка')
    } finally {
      setSaving(false)
    }
  }

  // How many dots to show filled:
  // - New user or pinDirty=true: actual pin.length
  // - Edit mode, not yet typed: 4 (placeholder dots)
  const filledDots = (isEdit && !pinDirty) ? 4 : pin.length

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0f0f14] border border-white/[0.1] rounded-[20px] w-full max-w-[460px] p-7" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="mb-6">
          <h3 className="text-[18px] font-bold text-white">
            {isEdit ? `Редакция — ${user.name}` : 'Нов потребител'}
          </h3>
          <p className="text-[12px] text-white/40 mt-1">
            {isEdit ? 'Промени данните и запази' : 'Попълни данните за новия акаунт'}
          </p>
        </div>

        <p className="text-[11px] font-bold text-white/30 uppercase tracking-[0.1em] mb-4">Достъп</p>

        {/* Role */}
        <div className="mb-4">
          <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-[0.07em] mb-2">Роля</label>
          <div className="grid grid-cols-3 gap-2">
            {ROLES.map(r => (
              <button key={r.value} onClick={() => setRole(r.value)}
                className={`rounded-[10px] border-2 p-3 text-center transition-colors ${role === r.value ? r.selectedClass : 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]'}`}
              >
                <div className="text-[22px] mb-1">{r.icon}</div>
                <div className="text-[11px] font-semibold text-white/70">{r.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div className="mb-4">
          <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-[0.07em] mb-1.5">Потребителско име</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Напр. Мария"
            className="w-full bg-white/[0.05] border border-white/[0.1] rounded-[10px] px-3.5 py-2.5 text-[14px] text-white placeholder:text-white/25 outline-none focus:border-white/[0.2]"
          />
        </div>

        {/* PIN */}
        <div className="mb-4">
          <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-[0.07em] mb-2">
            PIN код{isEdit ? ' (остави празно за без промяна)' : ''}
          </label>
          <div className="flex gap-2 justify-center mb-2">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className={`w-[42px] h-[42px] rounded-[10px] border-2 flex items-center justify-center transition-all ${i < filledDots ? 'border-amber-400/50 bg-amber-400/[0.1]' : 'border-white/[0.1] bg-white/[0.03]'}`}>
                {i < filledDots && <div className="w-[11px] h-[11px] rounded-full bg-amber-400" />}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1.5 max-w-[200px] mx-auto">
            {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
              <button key={i} onClick={() => d === '⌫' ? handlePinDelete() : d ? handlePinDigit(d) : undefined}
                disabled={!d}
                className={`h-11 rounded-[9px] text-base font-medium transition-all ${!d ? 'invisible' : d === '⌫' ? 'text-white/30 hover:text-white/50 hover:bg-white/[0.04]' : 'text-white/70 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] active:scale-95'}`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-white/[0.06] my-5" />
        <p className="text-[11px] font-bold text-white/30 uppercase tracking-[0.1em] mb-4">Профилна информация</p>

        {/* Phone */}
        <div className="mb-4">
          <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-[0.07em] mb-1.5">Телефонен номер</label>
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+359 88 ..."
            className="w-full bg-white/[0.05] border border-white/[0.1] rounded-[10px] px-3.5 py-2.5 text-[14px] text-white placeholder:text-white/25 outline-none focus:border-white/[0.2]"
          />
        </div>

        {/* Birth date + Hired at */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-[0.07em] mb-1.5">Рождена дата</label>
            <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)}
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-[10px] px-3.5 py-2.5 text-[14px] text-white/80 outline-none focus:border-white/[0.2]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-[0.07em] mb-1.5">Нает на</label>
            <input type="date" value={hiredAt} onChange={e => setHiredAt(e.target.value)}
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-[10px] px-3.5 py-2.5 text-[14px] text-white/80 outline-none focus:border-white/[0.2]"
            />
          </div>
        </div>

        {error && <p className="text-[13px] text-red-400/80 mb-4">{error}</p>}

        <div className="flex gap-2.5 mt-6">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-[12px] border border-white/[0.1] text-white/50 font-semibold text-[13px] hover:text-white/70 transition-colors">
            Отказ
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-[2] py-3 rounded-[12px] bg-gradient-to-r from-amber-400 to-orange-500 text-[#0a0a0f] font-bold text-[13px] disabled:opacity-50 hover:shadow-lg hover:shadow-amber-500/20 transition-all">
            {saving ? 'Запазвам...' : 'Запази'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

### Task 12: Users page

**Files:** Create `app/(dashboard)/users/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
// app/(dashboard)/users/page.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/hooks/useSession'
import { AppUser } from '@/src/types/database'
import UserCard from './components/UserCard'
import UserModal from './components/UserModal'

export default function UsersPage() {
  const { userRole } = useSession()
  const router = useRouter()

  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [modalUser, setModalUser] = useState<AppUser | undefined>(undefined)
  const [modalOpen, setModalOpen] = useState(false)

  // Role guard — useSession reads from localStorage (may be empty on first render)
  useEffect(() => {
    if (userRole && userRole !== 'admin') {
      router.replace('/')
    }
  }, [userRole, router])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setFetchError('')
    try {
      const res = await fetch('/api/users')
      if (!res.ok) throw new Error('Server error')
      const data = await res.json()
      setUsers(data.users ?? [])
    } catch {
      setFetchError('Грешка при зареждане. Опитай отново.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleToggleActive = async (user: AppUser) => {
    const res = await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !user.is_active }),
    })
    if (res.ok) {
      fetchUsers()
    } else {
      const data = await res.json()
      alert(data.error ?? 'Грешка')
    }
  }

  const activeUsers = users.filter(u => u.is_active)
  const inactiveUsers = users.filter(u => !u.is_active)
  const activeAdminCount = activeUsers.filter(u => u.role === 'admin').length

  const openAdd = () => { setModalUser(undefined); setModalOpen(true) }
  const openEdit = (u: AppUser) => { setModalUser(u); setModalOpen(true) }
  const closeModal = () => setModalOpen(false)
  const onSave = () => { closeModal(); fetchUsers() }

  if (loading) {
    return (
      <div className="min-h-screen p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="h-7 w-36 bg-white/[0.06] rounded-lg animate-pulse mb-2" />
            <div className="h-4 w-24 bg-white/[0.04] rounded animate-pulse" />
          </div>
          <div className="h-9 w-36 bg-white/[0.06] rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-[160px] bg-white/[0.03] rounded-[14px] border border-white/[0.06] animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="min-h-screen p-6 flex flex-col items-center justify-center gap-4">
        <p className="text-white/60">{fetchError}</p>
        <button onClick={fetchUsers}
          className="px-4 py-2 rounded-lg bg-white/[0.06] text-white/70 hover:bg-white/[0.1] text-sm font-medium transition-colors">
          Опитай отново
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-white">Потребители</h1>
          <p className="text-[13px] text-white/40 mt-0.5">
            {activeUsers.length} активни · {inactiveUsers.length} неактивни
          </p>
        </div>
        <button onClick={openAdd}
          className="bg-gradient-to-r from-amber-400 to-orange-500 text-[#0a0a0f] font-bold text-[13px] px-4 py-2.5 rounded-[10px] hover:shadow-lg hover:shadow-amber-500/20 transition-all">
          + Нов потребител
        </button>
      </div>

      {activeUsers.length > 0 && (
        <section className="mb-6">
          <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.15em] mb-3">
            Активни ({activeUsers.length})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeUsers.map(u => (
              <UserCard key={u.id} user={u}
                isLastAdmin={u.role === 'admin' && activeAdminCount === 1}
                onEdit={openEdit}
                onToggleActive={handleToggleActive}
              />
            ))}
          </div>
        </section>
      )}

      {inactiveUsers.length > 0 && (
        <section>
          <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.15em] mb-3">
            Неактивни ({inactiveUsers.length})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {inactiveUsers.map(u => (
              <UserCard key={u.id} user={u}
                isLastAdmin={false}
                onEdit={openEdit}
                onToggleActive={handleToggleActive}
              />
            ))}
          </div>
        </section>
      )}

      {modalOpen && (
        <UserModal user={modalUser} onSave={onSave} onClose={closeModal} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
. "$HOME/.nvm/nvm.sh" && cd ~/vitality-gym && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit Chunk 3**

```bash
git add app/(dashboard)/users/
git commit -m "feat(users): UI components — UserCard, UserModal, users page"
```

---

## Chunk 4: Login Page Update

### Task 13: Update login/page.tsx

**Files:** Modify `app/(auth)/login/page.tsx`

- [ ] **Step 1: Replace the entire file**

```tsx
// app/(auth)/login/page.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface LoginUser { id: string; name: string; role: string }

export default function LoginPage() {
  const router = useRouter()
  const [users, setUsers] = useState<LoginUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)   // login in-flight guard

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true)
    setLoadError(false)
    try {
      const res = await fetch('/api/auth/users')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setUsers(data.users ?? [])
    } catch {
      setLoadError(true)
    } finally {
      setLoadingUsers(false)
    }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleLogin = async () => {
    if (!selectedUser || loading) return   // loading guard prevents double-submit
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: selectedUser, pin }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Грешка при вход'); return }
      localStorage.setItem('vitality_session', JSON.stringify({
        name: data.name,
        role: data.role,
        employeeId: data.employeeId,
      }))
      const landingPage = data.role === 'admin' || data.role === 'instructor' ? '/hall' : '/shifts'
      router.push(landingPage)
    } catch {
      setError('Мрежова грешка')
    } finally {
      setLoading(false)
    }
  }

  const handlePinInput = (digit: string) => {
    if (pin.length < 4) { setPin(p => p + digit); setError('') }
  }
  const handlePinDelete = () => { setPin(p => p.slice(0, -1)); setError('') }

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

  return (
    <div className="min-h-screen bg-[#060609] flex items-center justify-center p-4">
      <div className="fixed inset-0 opacity-[0.015]" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
        backgroundSize: '32px 32px',
      }} />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center font-black text-[#0a0a0f] text-2xl mx-auto mb-4 shadow-lg shadow-amber-500/20">V</div>
          <h1 className="text-xl font-bold text-white tracking-tight">Vitality Gym</h1>
          <p className="text-xs text-white/30 mt-1 uppercase tracking-[0.2em]">Management System</p>
        </div>

        {/* Loading skeleton */}
        {loadingUsers && (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-[60px] rounded-2xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />
            ))}
          </div>
        )}

        {/* Fetch error */}
        {!loadingUsers && loadError && (
          <div className="text-center space-y-4">
            <p className="text-sm text-white/50">Грешка при зареждане. Опитай отново.</p>
            <button onClick={fetchUsers}
              className="px-4 py-2 rounded-xl bg-white/[0.06] text-white/60 hover:bg-white/[0.1] text-sm font-medium transition-colors">
              Опитай отново
            </button>
          </div>
        )}

        {/* User selection */}
        {!loadingUsers && !loadError && !selectedUser && (
          <div className="space-y-2">
            <div className="text-xs text-white/30 uppercase tracking-widest mb-4 text-center">Избери профил</div>
            {users.map(user => (
              <button key={user.id} onClick={() => setSelectedUser(user.name)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.1] transition-all group">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${roleColor[user.role] ?? 'from-white/20 to-white/10'} flex items-center justify-center font-bold text-[#0a0a0f] text-sm`}>
                  {user.name.charAt(0)}
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">{user.name}</div>
                  <div className="text-[10px] text-white/30 uppercase tracking-wider">{roleLabel[user.role] ?? user.role}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* PIN entry */}
        {!loadingUsers && !loadError && selectedUser && (
          <div>
            <button onClick={() => { setSelectedUser(null); setPin(''); setError('') }}
              className="flex items-center gap-3 mb-8 text-white/40 hover:text-white/60 transition-colors">
              <span className="text-sm">←</span>
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${roleColor[users.find(u => u.name === selectedUser)?.role ?? ''] ?? 'from-white/20 to-white/10'} flex items-center justify-center font-bold text-[#0a0a0f] text-xs`}>
                {selectedUser.charAt(0)}
              </div>
              <span className="text-sm">{selectedUser}</span>
            </button>

            <div className="flex justify-center gap-3 mb-8">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center transition-all ${i < pin.length ? 'border-amber-400/50 bg-amber-400/10' : 'border-white/[0.08] bg-white/[0.02]'}`}>
                  {i < pin.length && <div className="w-3 h-3 rounded-full bg-amber-400" />}
                </div>
              ))}
            </div>

            {error && <div className="text-center text-red-400/80 text-sm mb-4">{error}</div>}

            <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto">
              {['1','2','3','4','5','6','7','8','9','','0','⌫'].map(digit => (
                <button key={digit || 'empty'}
                  onClick={() => { if (digit === '⌫') handlePinDelete(); else if (digit) handlePinInput(digit) }}
                  disabled={!digit || loading}
                  className={`h-14 rounded-xl text-lg font-medium transition-all ${!digit ? 'invisible' : digit === '⌫' ? 'text-white/30 hover:text-white/50 hover:bg-white/[0.04]' : 'text-white/70 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] active:scale-95'}`}
                >
                  {digit}
                </button>
              ))}
            </div>

            <button onClick={handleLogin} disabled={pin.length !== 4 || loading}
              className="w-full mt-6 py-3.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-[#0a0a0f] font-bold text-sm disabled:opacity-30 hover:shadow-lg hover:shadow-amber-500/20 transition-all active:scale-[0.98]">
              {loading ? 'Влизам...' : 'Влез'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Start dev server and manually test login**

```bash
. "$HOME/.nvm/nvm.sh" && cd ~/vitality-gym && npm run dev
```

Open `http://localhost:3000/login` and verify:
- [ ] Skeleton cards appear while users load
- [ ] After load: 4 user cards displayed
- [ ] Dimitar + PIN 1234 → logs in → redirects to `/hall`
- [ ] Петър GYM + PIN 1111 → logs in → redirects to `/hall`
- [ ] Any user + wrong PIN → shows „Грешен PIN код"
- [ ] Network error (stop dev server mid-request) → retry button appears

- [ ] **Step 3: Verify TypeScript**

```bash
. "$HOME/.nvm/nvm.sh" && cd ~/vitality-gym && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit Chunk 4**

```bash
git add app/(auth)/login/page.tsx
git commit -m "feat(users): update login — async fetch from DB, API-based PIN verification"
```

---

## Chunk 5: End-to-End Verification

### Task 14: Smoke tests

- [ ] **Open `/users` as admin** — sees 4 cards in active section

- [ ] **Add new user**
  - Click „+ Нов потребител"
  - Role: Рецепционист, Name: „Тест", PIN: 5678, Phone: „+359 88 111 1111"
  - Save → card appears in active list

- [ ] **Edit the user**
  - Click ✏️ Промени on „Тест"
  - Change phone → Save → card reflects update
  - Open edit again → PIN shows 4 filled dots → type new digit → all 4 clear → enter 9999 → Save
  - Login as „Тест" with new PIN 9999 → succeeds

- [ ] **Duplicate name**
  - Try to add another user named „Тест" → shows „Потребител с това име вече съществува"

- [ ] **Deactivate user**
  - Deactivate „Тест" → moves to Неактивни section (faded)

- [ ] **Last-admin guard (UI)**
  - „Dimitar" is the only admin → Деактивирай button is disabled with tooltip

- [ ] **Last-admin guard (API)**
  - Manually PATCH: `curl -X PATCH .../api/users/[dimitar-id] -d '{"is_active":false}'`
  - Expected: 400 `{ error: 'Не можеш да деактивираш единствения администратор' }`

- [ ] **Navigate to `/users` as non-admin** — redirects away

- [ ] **Final commit**

```bash
git add -A
git commit -m "feat(users): complete — admin Users module with DB-backed login accounts"
```
