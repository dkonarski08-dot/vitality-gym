# API Routes — Security Rules

## Задължително за всеки route

```ts
import { GYM_ID } from '@/lib/constants'         // никога hardcode
import { supabaseAdmin } from '@/lib/supabaseAdmin' // само в API routes
import { requireRole } from '@/lib/auth'           // за POST/PUT/DELETE
```

### Всяка DB заявка трябва да има gym_id филтър
```ts
.eq('gym_id', GYM_ID)
```

### POST/PUT/DELETE изискват role guard горе в handler-а
```ts
export async function POST(req: NextRequest) {
  const authError = requireRole(req, 'admin')
  if (authError) return authError
  // ...
}
```

### Error responses — само generic съобщения
```ts
// ✅ Правилно
return NextResponse.json({ error: 'Not found' }, { status: 404 })

// ❌ Грешно — leak-ва DB детайли
return NextResponse.json({ error: error.message }, { status: 500 })
```

## Критична забрана

**НИКОГА не вземай роля от request body:**
```ts
// ❌ SECURITY HOLE — клиентът може да изпрати произволна роля
const { role } = await req.json()

// ✅ Ролята идва само от middleware headers
const role = req.headers.get('x-user-role')
```

## Известни пропуски (TODO)

### GET routes без auth — трябва да се добави `requireRole`
- `app/api/users/route.ts` — GET
- `app/api/deliveries/route.ts` — GET
- `app/api/hall-cash/route.ts` — GET
- `app/api/requests/route.ts` — GET

### Липсващи role guards в POST handlers
- `app/api/hall-cash/route.ts` — POST switch
- `app/api/deliveries/route.ts` — POST handler

## Checklist преди commit

- [ ] Импортиран `GYM_ID` от `@/lib/constants`?
- [ ] Всяка DB заявка има `.eq('gym_id', GYM_ID)`?
- [ ] POST/PUT/DELETE имат `requireRole` guard?
- [ ] `supabaseAdmin` не се използва в client компоненти?
- [ ] Error messages са generic (без DB детайли)?
- [ ] Ролята не се взема от `req.json()`?
