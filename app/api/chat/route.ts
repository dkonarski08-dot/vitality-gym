import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function getGymContext() {
  const [
    { data: employees },
    { data: members },
    { data: shifts },
    { data: monthlyHours },
    { data: expiringMemberships },
    { data: monthlyFinancials },
    { data: todaysShifts },
    { data: activeMemberships },
    { data: topClients },
    { data: gymSettings },
  ] = await Promise.all([
    supabase.from('employees').select('*').eq('active', true),
    supabase.from('members').select('*').eq('active', true),
    supabase.from('shifts').select('*, employees(name, role)').gte('date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]),
    supabase.from('employee_monthly_hours').select('*'),
    supabase.from('expiring_memberships').select('*'),
    supabase.from('monthly_financials').select('*').limit(6),
    supabase.from('todays_shifts').select('*'),
    supabase.from('active_memberships_count').select('*'),
    supabase.from('top_clients_by_revenue').select('*'),
    supabase.from('gym_settings').select('*').single(),
  ])

  return {
    employees,
    members,
    shifts,
    monthlyHours,
    expiringMemberships,
    monthlyFinancials,
    todaysShifts,
    activeMemberships,
    topClients,
    gymSettings,
  }
}

export async function POST(req: NextRequest) {
  const { message } = await req.json()

  const gymData = await getGymContext()

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: `You are the AI assistant for ${gymData.gymSettings?.gym_name || 'Vitality Gym'}. 
You have access to real-time gym data and help the owner manage their business.
Answer questions accurately based on the data provided.
Be concise, helpful and professional.
Always respond in the same language the user writes in (Bulgarian or English).

Current gym data:
${JSON.stringify(gymData, null, 2)}`,
    messages: [{ role: 'user', content: message }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  return NextResponse.json({ response: text })
}