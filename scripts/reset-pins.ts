import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import bcrypt from 'bcryptjs'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const GYM_ID = '00000000-0000-0000-0000-000000000001'

async function main() {
  const hash = await bcrypt.hash('000000', 10)
  console.log('Hash:', hash)

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const { data, error } = await supabase
    .from('app_users')
    .update({ pin_hash: hash })
    .eq('gym_id', GYM_ID)
    .select('id, name, role')

  if (error) {
    console.error('Error:', error)
    process.exit(1)
  }

  console.log(`Updated ${data?.length} users:`)
  data?.forEach(u => console.log(`  - ${u.name} (${u.role})`))
}

main()
