// scripts/seed-app-users.ts
// Run once after migration: npx tsx scripts/seed-app-users.ts
import { hash } from 'bcryptjs'
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
    const pin_hash = await hash(u.pin, 10)
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
