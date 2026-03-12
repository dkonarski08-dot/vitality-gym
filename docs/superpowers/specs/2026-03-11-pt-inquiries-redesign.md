# PT Inquiries Redesign — Spec

**Date:** 2026-03-11
**Scope:** Receptionist PT module — rename, inquiries table UX, form fixes

---

## Changes

### 1. Rename navigation label
- `'PT Календар'` → `'График ПТ'` in `src/modules/common/navigation.ts`

### 2. Inquiries table — full row layout
Replace expandable row UI with a flat table showing all details at a glance:

| Column | Content |
|--------|---------|
| Клиент | Name (bold) + phone (muted) + notes (italic, small) |
| Дни | Amber day chips (Пн/Вт/…); "Всеки ден" chip if all selected |
| Час | Sky-blue time chips — **multiple** slots shown stacked |
| Цел | Purple goal badge (emoji + label) |
| Инструктор | Avatar initials + name |
| Статус | Pulsing amber dot for active; green dot for done. Age badge (⏰ N дни) for pending >3 days |
| Действия | ✓ Спечелен / ✗ Загубен buttons for pending; dimmed row for done |

Stats pills above table: активни / спечелени / загубени / конверсия %

### 3. Form — Ново запитване fixes

**Multi-select time slots:**
Replace single-select radio with 3 tappable card buttons (Сутрин / Обяд / Вечер), each togglable independently. Sky-blue selected state with ✓ icon. Hint text below: "Можеш да избереш повече от един".

**Фитнес цел → dropdown** with 5 options:
1. ⚖️ Отслабване и стройност
2. 💪 Мускулна маса и сила
3. 🏃 Кардио и издръжливост
4. 🩺 Рехабилитация и здраве
5. ✨ Обща форма и тонус

Purple preview badge appears below dropdown after selection.

**Откъде разбра за нас** dropdown (stored in DB, not shown in table):
- 📘 Фейсбук
- 📸 Инстаграм
- 🔍 Гугъл
- 👥 Приятел
- 📍 Живея наблизо

**Phone validation:**
Bulgarian mobile numbers: 10 digits starting with `08` (e.g. `0888123456`) or with country code `+359` followed by 9 digits (e.g. `+359 88 123 4567`). Validate on submit — show inline error under phone field if invalid. Do not block typing.

### 4. Rename "Отказан" → "Загубен" everywhere
- Buttons, status labels, filter tabs, outcome values
- DB `outcome` field currently stores `'lost'` — no DB migration needed, only UI strings change
- `lost_reason` field label stays as-is (internal)

---

## DB Change
Add `source text` column to `pt_inquiries` table:
```sql
ALTER TABLE pt_inquiries ADD COLUMN source text;
```
Values: `facebook`, `instagram`, `google`, `friend`, `nearby`

No UI in table — stored for future admin stats reporting.

---

## Out of Scope (deferred)
- Admin stats breakdown by `source` — done later when working on admin module
- Admin module equivalent of these changes — separate session
