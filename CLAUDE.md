# Vitality Gym — Project Context for Claude Code

## За проекта
Custom gym management SaaS за Vitality Gym, Пловдив. Заменя части от GymRealm с модерен вътрешен инструмент.

## Tech Stack
- Next.js 14 App Router, TypeScript (strict), Tailwind CSS
- Supabase (PostgreSQL) — project ID: `enyyjoacjdkaygfpbimf`
- Vercel hosting
- Anthropic API за AI функции

## MCP Servers (Claude Code)
- **Supabase MCP** — директни DB операции (`mcp__supabase__*`)
- **GitHub MCP** — PR/issue management (`mcp__github__*`)
- **Playwright MCP** — browser automation & E2E тестване (`mcp__playwright__*`)
- **Memory MCP** — persistent knowledge graph (`mcp__memory__*`)
- **Context7 MCP** — library docs lookup (use when working with external libs)

## Hooks (Claude Code)
- **code-reviewer subagent** — автоматично се стартира след завършване на major стъпки

## Инсталирани плъгини (Skills)
- `superpowers` — brainstorming, planning, TDD, debugging, git worktrees, parallel agents, code review workflows
- `frontend-design` — production-grade UI компоненти с висок design quality
- `code-review` — PR code review
- `code-simplifier` — simplify & refine код след имплементация

## Claude Code Configuration

### Workflow Orchestration
1. **Plan Node Default** — Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions). If something goes sideways, STOP and re-plan immediately. Use plan mode for verification steps too.
2. **Subagent Strategy** — Use subagents liberally to keep main context window clean. Offload research, exploration, and parallel analysis to subagents. One task per subagent for focused execution.
3. **Self-Improvement Loop** — After ANY correction from the user: update `tasks/lessons.md` with the pattern. Write rules that prevent the same mistake. Review lessons at session start.
4. **Verification Before Done** — Never mark a task complete without proving it works. Ask: "Would a staff engineer approve this?" Run tests, check logs, demonstrate correctness.
5. **Demand Elegance (Balanced)** — For non-trivial changes: pause and ask "is there a more elegant way?" Skip for simple/obvious fixes. Challenge your own work before presenting.
6. **Autonomous Bug Fixing** — When given a bug report: just fix it. Point at logs/errors/tests → resolve them. Zero context switching from user.

### Task Management
1. Write plan to `tasks/todo.md` with checkable items
2. Check in before starting implementation
3. Mark items complete as you go
4. High-level summary at each step
5. Add review section to `tasks/todo.md`
6. Update `tasks/lessons.md` after corrections

### Core Principles
- **Simplicity First**: Make every change as simple as possible. Minimal code impact.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Only touch what's necessary. Avoid introducing bugs.

## Важни константи
```
GYM_ID: 00000000-0000-0000-0000-000000000001
SUPABASE_PROJECT_ID: enyyjoacjdkaygfpbimf
```

## Модели (Anthropic API)
```
✅ claude-haiku-4-5-20251001      — за бързи/евтини задачи
✅ claude-sonnet-4-6              — за сложни задачи (current)
✅ claude-opus-4-6                — за много сложни задачи
❌ claude-sonnet-4-5-20250514     — НЕ РАБОТИ (404 error)
```

## Стартиране
```bash
cd ~/vitality-gym && npm run dev
# или с nvm:
. "$HOME/.nvm/nvm.sh" && cd ~/vitality-gym && npm run dev
```

## Архитектура
```
app/(auth)/           — login страница (без sidebar)
app/(dashboard)/      — защитени страници (с sidebar)
app/api/              — API routes (server-side)
lib/                  — shared utilities (formatters, constants, supabase clients)
hooks/                — React hooks (useSession, useMonthNav)
components/layout/    — Sidebar и споделени компоненти
components/ui/        — reusable UI components (DiffBadge, DatePicker)
src/modules/          — module-specific логика
src/types/            — TypeScript типове
migrations/           — SQL файлове (reference, numbered 001-00N)
```

## Споделена инфраструктура (Shared)
- `lib/formatters.ts` — MONTHS_BG, DAYS_BG, DAYS_BG_SHORT, formatDate, formatDateShort
- `lib/constants.ts` — GYM_ID export (always import from here, never hardcode)
- `lib/supabase.ts` — client-side Supabase client
- `lib/supabaseAdmin.ts` — service-role client (API routes only)
- `hooks/useSession.ts` — reads vitality_session, returns { userRole, userName, employeeId }
- `hooks/useMonthNav.ts` — month nav state: { viewYear, viewMonth, monthStart, monthEnd, goToPrev/Next, reset }
- `components/ui/DiffBadge.tsx` — diff comparison badge
- `components/ui/DatePicker.tsx` — date picker component

## Кодови стандарти
- TypeScript strict — без `any`
- API routes: try/catch с meaningful error messages
- DB операции само в API routes (never в client components)
- `supabaseAdmin` (service role) само в API routes
- Batch DB операции — избягвай N+1 queries
- Всички нови таблици включват `gym_id uuid` за multi-tenancy

## Design System
- Dark theme: `bg-[#060609]` base
- Accent: `amber-400` / `orange-500` gradient
- Role colors: admin=amber, receptionist=sky/blue, instructor=emerald/green, cleaning=purple/violet
- Borders: `border-white/[0.06]`
- Text: white за primary, white/60-70 за secondary, white/40-50 за tertiary
- Cards: `bg-white/[0.03] border border-white/10 rounded-xl`
- Modals: `bg-[#0f0f14] border border-white/[0.1] rounded-2xl`
- **Валута: EUR (€)** — България използва евро

## UI език
**Български** — всички label-и, бутони, съобщения на български

## Текстов контраст
Потребителят е чувствителен към тъмен текст. Използвай white/70+ за label-и, white за стойности.

## Роли и достъп
- `admin` — пълен достъп, вижда заплати/финанси
- `receptionist` — вижда своите модули, без admin функции
- `instructor` — вижда само своите данни
- Session в localStorage (key: `vitality_session`) като `{ name, role, employeeId }`
- Използвай `useSession()` hook — никога директно localStorage в компоненти

## Текущи модули
| Модул | URL | Статус |
|-------|-----|--------|
| Login | /login | ✅ |
| Vitality Hall | /hall | ✅ |
| Shifts Calendar | /shifts | ✅ |
| Notes & Briefing | /notes | ✅ |
| Daily Cash | /cash | ✅ |
| Deliveries | /deliveries | ✅ |
| Delivery Requests | /requests | ✅ |
| PT Calendar | /pt | ✅ |
| Users (Accounts) | /users | ✅ |
| Daily Report | /daily-report | ✅ |
| Hall Cash | /hall-cash | ✅ |

## База данни — ключови таблици
```sql
employees       — персонал (roles: Reception, instructor, cleaning, admin)
shifts          — смени UNIQUE(staff_id, date)
pt_clients      — PT клиенти (preferred_days text[], preferred_time_slot text)
pt_packages     — пакети (starts_on date, duration_months int, expires_at date)
pt_sessions     — тренировки
pt_inquiries    — запитвания от потенциални клиенти
gym_settings    — работно време
public_holidays — български празници
app_users       — login акаунти (id, gym_id, name, role, pin_hash, employee_id, is_active)
```

## Supabase MCP бележка
Supabase MCP е свързан и работи (`mcp__supabase__*`). При проблем:
1. Supabase Dashboard → SQL Editor: https://supabase.com/dashboard/project/enyyjoacjdkaygfpbimf/sql/new
2. Или браузър JS fetch към Supabase API

## Предстоящи модули (не са направени)
violations, tasks, targets, payroll, clients, reports, email, reviews, settings
