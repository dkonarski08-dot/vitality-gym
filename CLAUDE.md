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

## Важни константи
```
GYM_ID: 00000000-0000-0000-0000-000000000001
SUPABASE_PROJECT_ID: enyyjoacjdkaygfpbimf
```

## Модели (Anthropic API)
```
✅ claude-haiku-4-5-20251001      — за бързи/евтини задачи
✅ claude-sonnet-4-5-20250929     — за сложни задачи
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
components/layout/    — Sidebar и споделени компоненти
src/modules/          — module-specific логика
src/types/            — TypeScript типове
migrations/           — SQL файлове (reference)
```

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
- Session в localStorage като `{ name, role }`

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
```

## Supabase MCP бележка
Supabase MCP е свързан и работи (`mcp__supabase__*`). При проблем:
1. Supabase Dashboard → SQL Editor: https://supabase.com/dashboard/project/enyyjoacjdkaygfpbimf/sql/new
2. Или браузър JS fetch към Supabase API

## Предстоящи модули (не са направени)
violations, tasks, targets, payroll, clients, reports, email, reviews, settings
