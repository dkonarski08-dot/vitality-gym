# Spec: Дневен отчет — обединена страница с табове

**Date:** 2026-03-12

## Цел
Обединяване на „Дневна каса — Фитнес" и „Дневна каса — Зала" в едно меню „Дневен отчет" за рецепционист. Администраторите запазват отделните си линкове без промяна.

## Промени в навигацията

**Само за рецепционист:**
- Премахват се: `💶 Дневна каса — Фитнес` (`/cash`) и `🎽 Дневна каса — Зала` (`/hall-cash`)
- Добавя се: `🗒️ Дневен отчет` → `/daily-report` (различна икона от admin „Отчети" 📊)

**Конкретна промяна в `navigation.ts`:**
- `cash` и `hall-cash` items: промени `roles: ['admin', 'receptionist']` → `roles: ['admin']`
- Добави нов item `daily-report` с `roles: ['receptionist']`

**Администратор:** без промяна — запазва `/cash` и `/hall-cash` като отделни елементи.

**Достъп:** Не се добавят redirects. След промяната `/cash` и `/hall-cash` са de facto admin-only pages — рецепционистите просто не виждат линковете. Съществуващите `userRole !== 'admin'` ветки в двете pages стават dead code (приемливо, не се изтриват за да се избегнат нежелани промени).

## Нова страница `/daily-report`

**Route:** `app/(dashboard)/daily-report/page.tsx`

**Layout:**
```
[ ДНЕВЕН ОТЧЕТ — заглавие ]
[ ОТЧЕТ - ФИТНЕС ] [ ОТЧЕТ - ЗАЛА ]   ← tab bar
─────────────────────────────────────
[ активен таб съдържание ]
```

- Tab state: локален React state (без URL params), default: ФИТНЕС
- Страницата предоставя собствено заглавие и tab bar
- Таб компонентите **не рендират** собствени headers и нямат `min-h-screen`

## Компонент: Фитнес каса

**Файл:** `app/(dashboard)/cash/components/ReceptionistView.tsx` (вече съществува)

Нов prop: `embedded?: boolean`
- При `embedded={true}`: пропуска вътрешния `<CashHeader>` и заменя root `<div className="min-h-screen ...">` с обикновен `<div>`
- При `embedded={false}` (default): поведение без промяна — запазва пълния layout за `/cash` admin страницата

Новата страница:
- Импортира `useCash` от `app/(dashboard)/cash/hooks/useCash.ts`
- `useCash()` вътрешно чете `userRole` и прави fetch за месеца — за рецепционист това е приемливо (работи коректно, данните са само за рецепциониста)
- Подава receptionist-релевантните props на `<ReceptionistView embedded={true} />`

## Компонент: Зала каса

**Нов файл:** `app/(dashboard)/hall-cash/components/ReceptionistHallView.tsx`

Self-contained компонент — сам извлича данните си:
- Вика `fetch('/api/hall-cash?role=receptionist')` при mount — API автоматично връща днес + вчера за non-admin, `?date` param не е нужен
- Извиква `useSession()` за `userName` (нужен при `handleStaffSave` POST)
- Локален state: `cashTurnover`, `systemTurnover`, `staffNotes`, `saving`, `saved`, `error`, `records`, `loading`
- Съдържа `loadData`, `handleStaffSave`, `handleAckAlert` вътре в компонента
- **Без вътрешен header, без `min-h-screen`** — layout-neutral за вграждане в tab

**`hall-cash/page.tsx`:**
- Receptionist ветката (`if (userRole !== 'admin')`) заменя inline JSX с `<ReceptionistHallView />`
- Admin view остава непроменен
- `useMonthNav`, admin state, `loadData` за admin — всичко непроменено

## Файлове за промяна

| Файл | Действие |
|------|----------|
| `src/modules/common/navigation.ts` | Замени двата cash items с един `daily-report` за receptionist |
| `app/(dashboard)/cash/components/ReceptionistView.tsx` | Добави `embedded?: boolean` prop (пропуска header + min-h-screen) |
| `app/(dashboard)/hall-cash/components/ReceptionistHallView.tsx` | Нов self-contained компонент (без header, без min-h-screen) |
| `app/(dashboard)/hall-cash/page.tsx` | Замени inline receptionist JSX с `<ReceptionistHallView />` |
| `app/(dashboard)/daily-report/page.tsx` | Нова страница с tab bar |

## Без промяна
- `app/(dashboard)/cash/page.tsx` — непроменен
- `app/(dashboard)/cash/hooks/useCash.ts` — непроменен
- Всички API routes — непроменени
- Admin navigation — непроменена
