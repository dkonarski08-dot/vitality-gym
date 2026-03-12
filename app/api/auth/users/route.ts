// app/api/auth/users/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { GYM_ID } from '@/lib/constants'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('app_users')
      .select('id, name, role')
      .eq('gym_id', GYM_ID)
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) throw error
    return NextResponse.json({ users: data ?? [] })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
