# PT Statistics Redesign — Design Spec

**Date:** 2026-03-11
**Status:** Approved
**Module:** `/pt` → tab `📊 Статистика` → `PTAdminKPI`

---

## Overview

Enhance the PT Statistics (admin-only) tab with:
1. Monthly navigation (‹ Март 2026 ›) with year toggle
2. Trend indicators on KPI cards (↑ +21%, ↓ −25%)
3. "Спечелени клиенти" conversion card with progress bar
4. Source distribution (bar chart — откъде разбраха)
5. "Последни 6 месеца" table with inquiry + conversion + revenue data

---

## Data Requirements

### Existing API (`/api/pt?type=kpi`)
Currently returns: sessions, clients, packages for a period (month/year).

### New API needs
- Accept `month=YYYY-MM` param (in addition to existing `period=month|year`)
- Also return `inquiries` for the selected period: id, outcome, source, created_at
- For trend calculation: also return previous period data (prev month or prev year)

### New `type=kpi_monthly` endpoint (or extend existing `type=kpi`)
Parameters:
- `month=YYYY-MM` — specific month (new)
- `period=year&year=2026` — full year (new)
- `period=month` — current month (existing, kept for compatibility)

Returns additional fields:
```json
{
  "inquiries": [{ "id", "outcome", "source", "created_at" }],
  "prev_sessions": [...],
  "prev_packages": [...],
  "prev_inquiries": [...]
}
```

---

## Component Architecture

### `PTAdminKPI` — state changes
- Replace `period: 'month' | 'year'` toggle with:
  - `viewYear: number` (default: current year)
  - `viewMonth: number | null` (null = year view)
- Navigation:
  - ‹ / › buttons change `viewMonth` (or `viewYear` when in year view)
  - "2026" pill toggles between month view and year view
  - In year view: nav buttons change `viewYear`
- API call uses `month=YYYY-MM` for month view, `year=YYYY` for year view

### Navigation bar layout
```
[‹]  [Март 2026]  [›]  [2026]
```
- Right pill: shows current year, highlighted amber when in year view

### KPI Cards (4 cards)
Each shows: value + trend badge
- Trend = `((current - prev) / prev * 100)` rounded to 0 decimal
- `↑ +12%` in emerald if positive, `↓ −5%` in red if negative, neutral if 0 or no prev data
- Cards: Проведени, No-show (rate), Активни клиенти, Приходи

### Conversion Card (Спечелени клиенти)
- Full-width card below KPI row
- Large `68%` value + "(17 от 25)" subtitle
- Mini stats: ● 17 спечелени  ● 5 загубени  ● 3 активни (pending)
- Progress bar (emerald gradient, width = conversion %)
- Trend badge top-right: `↑ +8%`
- Only rendered when there are inquiries with `outcome` set

### Source Distribution
- Section header: "Откъде разбраха за нас"
- Horizontal bar per source (facebook, instagram, google, friend, nearby)
- Bar width = % of total inquiries with known source
- Colors: facebook=#4267B2, instagram=#E1306C, friend=#34d399, google=#fbbf24, nearby=#a78bfa
- Only show sources that have at least 1 inquiry

### "Последни 6 месеца" Table
- Always visible in month view (below source section)
- Hidden in year view (year view shows per-month breakdown differently)
- Columns: Месец | Запитвания | Спечелени | Конв.% | Приходи
- Current month row highlighted (slightly brighter text)
- Data: fetched via parallel calls or included in single API response

---

## API Changes

### `GET /api/pt?type=kpi`
Extend to support new params while keeping backward compat:

```
?type=kpi&month=2026-03          → specific month + prev month for trend
?type=kpi&year=2026              → full year data + prev year for trend
?type=kpi&period=month           → current month (existing, still works)
```

Add `inquiries` to response:
```sql
SELECT id, outcome, source, created_at
FROM pt_inquiries
WHERE gym_id = $GYM_ID
  AND created_at >= $start AND created_at <= $end
```

For "Последни 6 месеца" table — add `monthly_summary` array:
```json
"monthly_summary": [
  { "month": "2026-03", "inquiries": 25, "won": 17, "revenue": 840 },
  ...
]
```

---

## UI Language
All labels in Bulgarian. Trend arrows are symbols (↑ ↓), no text explanation.

---

## Out of Scope
- Per-instructor source breakdown
- Export/CSV
- Inquiry source editing from this view
