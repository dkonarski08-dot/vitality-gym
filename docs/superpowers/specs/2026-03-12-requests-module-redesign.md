# Spec: ЗАЯВКИ модул — пълен rebuild

**Дата:** 2026-03-12
**Статус:** готов за имплементация

---

## Контекст

Текущият ЗАЯВКИ модул е функционален, но с няколко проблема:
- Единна страница смесва история, чернова и продукти — претрупан UX
- Търсачката игнорира `clean_name` колоната
- Липсва "По доставчик" таб
- `useRequests` hook е 213 реда без разделение на отговорности
- API прави излишни DB заявки (категории = отделен call)
- Липсва `reject` action
- `clean_names` обработва всички продукти вместо само NULL записи

---

## База данни (съществуваща, без промени)

```
delivery_products   — id, gym_id, name, clean_name (може NULL), category, unit,
                      last_price, order_count, last_ordered_at
delivery_requests   — id, gym_id, month (YYYY-MM), status, created_by,
                      approved_by, approved_at, notes, ai_suggestions,
                      created_at, updated_at
delivery_request_items — id, request_id, product_id (nullable), product_name,
                          quantity, unit, note
deliveries          — id, gym_id, supplier_id, supplier_name, status
delivery_items      — id, delivery_id, product_name, product_code, category,
                      unit, unit_price
suppliers           — id, gym_id, name, active
```

**Реален DB state:** 14 продукта, всички с `clean_name = NULL`. 5 доставчика с история.

**Показване на имена навсякъде:** `clean_name ?? name`

---

## Структура на страницата

Страницата има **два отделни view-а** — изборът зависи от наличието на активна чернова (`status = 'draft'`) за текущия месец.

### История view (няма активна чернова)

- Header: "Заявки за доставки" + amber gradient "+ Нова заявка" бутон
- Admin: status filter pills — Всички / Чернова / Изпратена / Одобрена
- Admin: "🤖 Генерирай чисти имена" бутон вдясно в header-а
- Receptionist: вижда ВСИЧКИ заявки (не само своите), без filter pills и без admin actions
- Списък с минали заявки (карти):
  - Месец + година, статус badge, created_by, брой продукти
  - "Преглед" бутон → read-only modal
  - Admin: "Одобри" / "Отхвърли" бутони на submitted заявки (custom confirm modal)
- Past request modal:
  - Списък с продуктите (clean_name ?? name, количество, единица)
  - AI suggestions ако има
  - "Добави всичко към нова заявка" бутон (затваря модала, създава чернова, превключва към Нова заявка view)

### Нова заявка view (активна чернова)

- Header:
  - "← Назад" (връща в История, черновата остава)
  - "Нова заявка — [месец] [година]" (на български: "март 2026")
  - "🚀 Изпрати заявката" бутон (amber gradient)
  - Admin само: "История →" бутон (винаги достъпен, отваря История view)
- Layout: **60% product picker | 40% draft panel**
- На мобилно: двата панела се наредят вертикално

---

## Product picker (60%)

### Търсачка (винаги видима, над табовете)

- Input: "Търси продукт..." — autocomplete при мин. 2 букви
- API търси в `name` и `clean_name` (`ilike` на двете полета)
- Dropdown с резултати: clean_name ?? name, категория, order_count
- Enter / click добавя в черновата
- Ако няма съвпадение → "+ Добави '[query]' като нов продукт" опция

### Два таба

**Таб "По категория" (default):**
- Хоризонтални category pills: `[ Всички ⭐ ] [ Протеини ] [ Напитки ] ...`
- "Всички" е default → показва всички продукти сортирани по `order_count DESC`
- Избор на категория → филтрира grid-а
- Категориите се извеждат client-side от топ продуктите (без отделен API call)
- Grid от карти: clean_name ?? name, order_count, amber highlight ако е в черновата

**Таб "По доставчик":**
- Dropdown за избор на доставчик (от `deliveries` JOIN `delivery_items`)
- След избор: grid с продукти исторически поръчвани от него
  - Query: `SELECT DISTINCT di.product_name, di.unit FROM delivery_items di JOIN deliveries d ON di.delivery_id = d.id WHERE d.gym_id = GYM_ID AND d.supplier_name = X ORDER BY di.product_name`
  - Matched с `delivery_products` за clean_name (left join по name)
- Ако доставчикът няма история: "Няма данни за този доставчик"

### "+ Добави продукт ръчно"

- Текстов link под grid-а
- Отваря inline input (не отделна страница)
- При потвърждение добавя custom продукт в черновата (product_id = null)

---

## Draft panel (40%)

- "Чернова" заглавие + "N продукта" badge
- Списък с items:
  - clean_name ?? product_name
  - Unit label
  - Quantity stepper: `[ − ] [ число ] [ + ]` (цели числа, мин. 1)
  - Optional note field (едноредов input, показва се при hover/focus)
  - X бутон за премахване
- Textarea: "Бележка за доставчика..."
- Два бутона:
  - "💾 Запази чернова" — upsert items без смяна на статус
  - "🚀 Изпрати" — вж. Submit flow

---

## Submit flow

1. Клиентът извиква `save_draft` (записва последното състояние)
2. Клиентът извиква `submit` → сървърът:
   a. Проверява: ако черновата няма items → връща `400 Bad Request`
   b. Взима draft items
   c. Взима топ поръчвани продукти с `order_count > 1`
   d. Праща към claude-haiku-4-5-20251001 за проверка на липсващи
   e. AI връща **структуриран JSON**: `{ prose: string, suggestions: { name: string, unit: string }[] }`
      - `prose` = кратко Bulgarian обяснение (1-2 изречения)
      - `suggestions` = списък с конкретни продукти за добавяне (може да е празен `[]`)
   f. Сървърът записва `ai_suggestions = prose` в DB
   g. Връща `{ ai_suggestions: prose, suggested_products: suggestions }`
3. Ако `suggested_products.length > 0`:
   - Показва `AISuggestionsModal` с prose текст + карти за всеки предложен продукт
   - "Добави всички и изпрати" → добавя `suggested_products` към черновата, после `submit`
   - "Изпрати без промяна" → директен `submit` (статусът се сменя веднага)
   - Ако `suggested_products` е `[]` (AI казва "всичко е наред") → директно `submit`
4. Статусът се сменя на `submitted`
5. Превключва към История view

**AI prompt за submit проверка:**
```
User: "Ти си асистент за фитнес зала. Проверяваш заявка за доставка.
Текуща заявка: [product names]
Най-поръчвани продукти: [top products with order_count]

Ако забележиш обичайни продукти, които липсват, предложи ги.
Върни САМО JSON (без markdown): { \"prose\": \"...\", \"suggestions\": [{\"name\": \"...\", \"unit\": \"...\"}] }
Ако всичко изглежда пълно, върни: { \"prose\": \"Заявката изглежда пълна.\", \"suggestions\": [] }"
```

---

## Admin функции

### Одобри / Отхвърли
- Видими само за admin на submitted заявки в История view
- Custom `ConfirmModal` (без `window.confirm()`)
- `approve` → `status = 'approved'`, записва `approved_by` и `approved_at`
- `reject` → `status = 'rejected'` (нов статус, нов action в API)

### 🤖 Генерирай чисти имена
- Бутон в История header-а, само за admin
- Праща `action = 'clean_names'` към API
- API взима само продукти с `clean_name IS NULL` (не всички продукти)
- Обработва на батчове от 20 с claude-haiku-4-5-20251001
- Записва `clean_name` за всеки продукт (полето `name` остава непроменено)
- Показва резултат: "✓ Генерирани N clean имена" или "✓ Няма продукти за обработка"

**Разлика от старото `cleanup_names`:** Старото action коригираше правопис в `name` и update-ваше `delivery_items.product_name`. Новото `clean_names` пише само в `clean_name` и не пипа `name`. Старото `cleanup_names` action **се премахва** — `clean_name` замества нуждата от него.

**AI prompt (system):** "You are a product name cleaner for a Bulgarian gym shop. Given raw supplier invoice product names, return clean short Bulgarian-friendly display names. Remove: supplier codes, long dimensions/weights if obvious, dates, model numbers unless they distinguish the product. Keep: brand, product type, key variant (flavor/size if important). Return ONLY a JSON array of objects: [{\"original\": \"...\", \"clean\": \"...\"}]. No markdown, no explanation."

**Важно:** `product_name` в `delivery_request_items` се resolve-ва при добавяне (`clean_name ?? name` по онова време) и не се update-ва ретроактивно когато `clean_name` се генерира по-късно. Това е умишлено.

---

## API — `/api/requests/route.ts` (пълен rewrite)

### GET endpoints

| Параметър | Описание | Оптимизация |
|-----------|----------|-------------|
| (none) | Списък заявки + активна чернова | - |
| `?type=top` | Топ продукти по `order_count DESC` WHERE `gym_id = GYM_ID` | Категориите се извеждат client-side — без отделен `/categories` call |
| `?type=supplier&name=X` | Продукти на доставчик от delivery history | JOIN `delivery_items → deliveries` |
| `?type=search&q=X` | Autocomplete (мин. 2 букви) | Търси в `name` И `clean_name` |
| `?type=suppliers` | Списък доставчици с история | `SELECT d.supplier_name, COUNT(DISTINCT di.product_name) as product_count FROM deliveries d JOIN delivery_items di ON di.delivery_id = d.id WHERE d.gym_id = GYM_ID GROUP BY d.supplier_name ORDER BY product_count DESC` |

### POST actions

| action | Описание |
|--------|----------|
| `create_draft` | Нова чернова за текущия месец (month = server-side `new Date().toISOString().slice(0,7)`); проверява дали вече има чернова за месеца преди да създаде нова |
| `save_draft` | Upsert items (delete + re-insert по request_id) |
| `submit` | Смяна на статус + AI check за липсващи |
| `approve` | Admin: `status = 'approved'` |
| `reject` | Admin: `status = 'rejected'` (нов) |
| `clean_names` | Admin: AI генериране на `clean_name` само за NULL записи |

---

## Файлова структура

```
app/(dashboard)/requests/
  page.tsx                        — зарежда session, решава кой view
  types.ts                        — всички TS типове за модула
  components/
    RequestsHeader.tsx            — header за История view
    HistoryView.tsx               — списък минали заявки
    RequestModal.tsx              — read-only modal за минала заявка
    NewRequestView.tsx            — wrapper за draft view (header + layout)
    ProductPicker.tsx             — търсачка + табове
    ProductCard.tsx               — единична карта в grid-а
    DraftPanel.tsx                — десен панел с items
    AISuggestionsModal.tsx        — AI предложения след submit
    ConfirmModal.tsx              — reusable confirm (без browser confirm())
  hooks/
    useRequests.ts                — data fetching + мутации
app/api/requests/route.ts         — пълен rewrite
```

**Правило за размер:** Всеки файл > 300 реда се разбива допълнително.

---

## TypeScript типове (types.ts)

```typescript
export type RequestStatus = 'draft' | 'submitted' | 'approved' | 'rejected'

export interface DeliveryProduct {
  id: string
  name: string
  clean_name: string | null
  category: string
  unit: string
  last_price: number | null
  order_count: number
}

export interface DraftItem {
  product_id: string | null
  product_name: string           // clean_name ?? name при добавяне
  quantity: number               // цяло число, мин. 1
  unit: string
  note: string | null
}

export interface SavedDraftItem extends DraftItem {
  id: string
}

export interface DeliveryRequest {
  id: string
  month: string                  // YYYY-MM
  status: RequestStatus
  created_by: string
  approved_by: string | null
  notes: string | null
  ai_suggestions: string | null
  created_at: string
  delivery_request_items: SavedDraftItem[]
}

export interface Supplier {
  supplier_name: string
  product_count: number
}
```

---

## Design system

- Dark base: `bg-[#060609]`
- Cards: `bg-white/[0.03] border border-white/10 rounded-xl`
- Modals: `bg-[#0f0f14] border border-white/[0.1] rounded-2xl backdrop-blur`
- Accent: amber-400 / orange-500 gradient
- Status badge colors:
  - draft → `bg-white/10 text-white/50`
  - submitted → `bg-amber-500/15 text-amber-400`
  - approved → `bg-emerald-500/15 text-emerald-400`
  - rejected → `bg-red-500/15 text-red-400`
- Text: white за стойности, white/70 за labels, white/40 за tertiary
- Валута: EUR (€)
- Език: Bulgarian (UI labels)

---

## Извън обхвата

- Нямаме нужда от DB миграции — всички колони съществуват
- `delivery_requests` нямат UNIQUE constraint за (gym_id, month, status='draft') — API трябва да проверява преди `create_draft` дали вече има чернова
- Мобилна responsive: двата панела се наредят вертикално (flex-col на < lg)
