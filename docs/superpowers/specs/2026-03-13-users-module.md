# Spec: Модул „Потребители"

**Дата:** 2026-03-13
**Статус:** Revised v3

---

## Цел

Добавяне на admin-only модул за управление на login акаунти. Заменя hardcoded масива `USERS` в `login/page.tsx` с динамични записи от нова таблица `app_users` в Supabase.

**Разграничение:**
- `employees` — HR записи (заплати, смени, PT). Остава непроменена.
- `app_users` — login акаунти. Нова таблица. Може да се линкне към `employees` чрез `employee_id` (nullable за admin без employee запис).

---

## Нова зависимост

```
bcryptjs + @types/bcryptjs
```

**Bcryptjs се използва навсякъде** — и при seed (Node скрипт), и в API routes. `pgcrypto` НЕ се използва за хеширане на PIN кодове, за да се избегне несъвместимост между pgcrypto Blowfish формат и bcryptjs формат.

---

## Засегнати файлове

| Файл | Промяна |
|---|---|
| `app/(auth)/login/page.tsx` | Чете потребители от `/api/auth/users`; login → `/api/auth/login` |
| `src/modules/common/navigation.ts` | Добавя `Потребители` след `reviews`, преди `settings` |
| `src/types/database.ts` | Добавя `AppUser` интерфейс |
| `app/(dashboard)/users/page.tsx` | Нова страница |
| `app/(dashboard)/users/components/UserCard.tsx` | Нов компонент |
| `app/(dashboard)/users/components/UserModal.tsx` | Нов компонент |
| `app/api/users/route.ts` | GET (list), POST (create) |
| `app/api/users/[id]/route.ts` | PUT (edit), PATCH (toggle active) |
| `app/api/auth/login/route.ts` | POST (verify PIN, return session) |
| `app/api/auth/users/route.ts` | GET (active users list за login страницата) |
| `migrations/005_app_users.sql` | Нова миграция (само DDL) |
| `scripts/seed-app-users.ts` | Нов seed скрипт (Node.js, bcryptjs) |

---

## База данни

### Миграция `005_app_users.sql` (само DDL — без seed данни)

```sql
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

-- Nullify plaintext PINs from employees table
UPDATE employees SET pin_code = NULL;
```

### Seed скрипт `scripts/seed-app-users.ts`

Отделен Node.js скрипт, изпълняван веднъж след миграцията:

```ts
// Логика:
// 1. import bcryptjs
// 2. За всеки от 4-те hardcoded потребители: bcryptjs.hash(pin, 10)
// 3. INSERT INTO app_users с генерираните hashes
// 4. employee_id: търси в employees по name ILIKE
```

Скриптът се изпълнява с: `npx ts-node scripts/seed-app-users.ts`

### `employees.pin_code` колона

`pin_code` се nullify-ва в миграцията (UPDATE employees SET pin_code = NULL). Колоната остава в таблицата (не се трие) за обратна съвместимост.

---

## TypeScript тип `AppUser`

Добавя се в `src/types/database.ts`:

```ts
export interface AppUser {
  id: string
  gym_id: string
  name: string
  role: 'admin' | 'receptionist' | 'instructor'
  employee_id: string | null
  phone: string | null
  birth_date: string | null   // ISO date string (YYYY-MM-DD)
  hired_at: string | null     // ISO date string
  is_active: boolean
  created_at: string
  updated_at: string
  // pin_hash НЕ е включен — никога не се връща към клиента
}
```

**Забележка:** `UserRole` в `hooks/useSession.ts` дефинира локален тип. При работа с `AppUser` се използва `AppUser['role']` или общият `UserRole` от `src/types/database.ts`. Cleaning ролята е умишлено изключена от `app_users`.

---

## Навигация

```ts
// В navigation.ts — след 'reviews', преди 'settings'
{ key: 'users', label: 'Потребители', icon: '👤', href: '/users', roles: ['admin'] }
```

---

## Страница `/users`

**Достъп:** само `admin`. При друга роля → redirect към `/`.

### Секции

1. **Header** — „Потребители", subtitle „X активни · Y неактивни", бутон „+ Нов потребител"
2. **Активни** — карти grid (`section-label` „Активни (X)")
3. **Неактивни** — карти grid (opacity 45%, `section-label` „Неактивни (Y)")

### `UserCard` компонент

```ts
interface UserCardProps {
  user: AppUser
  onEdit: (user: AppUser) => void
  onToggleActive: (user: AppUser) => void
  isLastAdmin: boolean  // за да disabled-не бутона Деактивирай
}
```

Показва:
- Аватар (инициал, gradient по роля: admin=amber, receptionist=sky, instructor=emerald)
- Потребителско име + role badge (цветен по роля)
- Status pill (● Активен / ○ Неактивен)
- Телефон + Рождена дата
- Бутони: `✏️ Промени` | `⊘ Деактивирай` (или `✓ Активирай` за неактивни)

**Last-admin guard (UI):** Ако `isLastAdmin=true` → бутонът `Деактивирай` е `disabled` с tooltip „Не можеш да деактивираш единствения администратор".

`isLastAdmin` се пресмята в page компонента: `user.role === 'admin' && activeAdminCount === 1`.

### `UserModal` компонент

```ts
interface UserModalProps {
  user?: AppUser          // undefined = режим "Нов"
  onSave: () => void      // refresh списъка след успех
  onClose: () => void
}
```

**Секция „Достъп"**
- Избор на роля — 3 карти (👑 Админ / 🖥 Рецепция / 💪 Инструктор)
- Поле „Потребителско име"
- PIN поле — custom 4-cell компонент (идентичен с login страницата: 4 клетки, всяка показва dot при въведена цифра)
  - **Нов потребител:** всичките 4 клетки празни
  - **Редакция:** всичките 4 клетки показват попълнени dots (текущ PIN е скрит). При въвеждане на първа цифра — всичките 4 клетки се изчистват и въвеждането започва от нулата.
  - При редакция PIN е незадължителен — ако потребителят не въведе нищо, PIN остава непроменен.

**Секция „Профилна информация"**
- Телефонен номер (text input)
- Рождена дата + Нает на (date inputs, два в ред)

**Валидация (client-side):**
- Роля — задължителна
- Потребителско име — задължително, непразно
- PIN — задължителен при нов потребител; точно 4 цифри (0–9)

---

## API Routes

### `GET /api/auth/users`
Връща `{ id, name, role }[]` на активните потребители. `id` е включен за бъдеща употреба. **Без `pin_hash`.**
Сортиране: по `name ASC`.

### `POST /api/auth/login`

**Request:** `{ name: string, pin: string }`

**Логика (Node.js, bcryptjs):**
```ts
// 1. Намери потребителя по name + gym_id (exact case match)
const user = await supabaseAdmin
  .from('app_users')
  .select('name, role, employee_id, pin_hash, is_active')
  .eq('gym_id', GYM_ID)
  .eq('name', name)
  .single()

// 2. Провери PIN с bcryptjs (не SQL!)
const isValid = await bcryptjs.compare(pin, user.pin_hash)
if (!isValid) return 401 { error: 'Грешен PIN код' }

// 3. Провери статус
if (!user.is_active) return 403 { error: 'Акаунтът е деактивиран' }

// 4. Върни сесийни данни
return 200 { name: user.name, role: user.role, employeeId: user.employee_id }
```

**Response 200:** `{ name: string, role: string, employeeId: string | null }`
**Response 401:** `{ error: 'Грешен PIN код' }`
**Response 403:** `{ error: 'Акаунтът е деактивиран' }`

### `GET /api/users`
Всички `app_users` за gym_id (без `pin_hash`), сортирани `is_active DESC, name ASC`.

### `POST /api/users`
**Request:** `{ name, role, pin, phone?, birth_date?, hired_at?, employee_id? }`
- Хешира PIN: `await bcryptjs.hash(pin, 10)`
- **Response 409:** `{ error: 'Потребител с това име вече съществува' }`
- Задава `updated_at: new Date().toISOString()`

### `PUT /api/users/[id]`
**Request:** `{ name, role, pin?, phone?, birth_date?, hired_at?, employee_id? }`
- Ако `pin` е подаден (непразен string) → `await bcryptjs.hash(pin, 10)`, иначе не се включва `pin_hash` в UPDATE.
- Задава `updated_at: new Date().toISOString()`
- **Last-admin guard:** Ако `role !== 'admin'` AND `currentUser.role === 'admin'`:
  ```ts
  const { count } = await supabaseAdmin
    .from('app_users')
    .select('id', { count: 'exact' })
    .eq('gym_id', GYM_ID)
    .eq('role', 'admin')
    .eq('is_active', true)
    .neq('id', id)   // изключва текущия запис
  if (count === 0) return 400 { error: 'Не можеш да смениш ролята на единствения администратор' }
  ```
- **Response 409:** `{ error: 'Потребител с това име вече съществува' }` (при duplicate name)

### `PATCH /api/users/[id]`
**Request:** `{ is_active: boolean }`
- Задава `updated_at: new Date().toISOString()`
- **Last-admin guard** (при `is_active=false`):
  ```ts
  const { count } = await supabaseAdmin
    .from('app_users')
    .select('id', { count: 'exact' })
    .eq('gym_id', GYM_ID)
    .eq('role', 'admin')
    .eq('is_active', true)
    .neq('id', id)   // изключва текущия запис
  if (count === 0) return 400 { error: 'Не можеш да деактивираш единствения администратор' }
  ```

---

## Login страница — промени

### Зареждане при mount
```ts
// fetch('/api/auth/users') → setState(users)
```
- **Loading state:** 4 skeleton карти с pulse анимация (placeholder boxes)
- **Error state:** „Грешка при зареждане. Опитай отново." + retry бутон (re-calls fetch)

### Верификация
`POST /api/auth/login` с `{ name: selectedUser, pin }`.
При успех → `localStorage.setItem('vitality_session', JSON.stringify(response))` → redirect.
При 401/403 → показва `response.error`.

---

## Сигурност

- `pin_hash` **никога** не се включва в API responses към клиента
- `GET /api/auth/users` е публичен (необходим за login страницата) — излага само имена и роли на активни потребители; приемливо за вътрешен инструмент
- `/api/users` write endpoints — admin-only по конвенция, consistent с останалите API routes в проекта
- `app_users` се достъпва само чрез `supabaseAdmin` в API routes (service role — анонимен достъп невъзможен)

---

## Извън обхвата

- Supabase Auth интеграция
- Rate limiting / brute-force protection на login endpoint
- Audit log
- Profile снимки
- `cleaning` роля login
- Server-side auth guard на `/api/users` write endpoints
