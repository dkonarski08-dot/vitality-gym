import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

async function getGymContextSummary() {
  const [
    { count: employeeCount },
    { count: memberCount },
    { count: leadCount },
    { data: gymSettings },
    { data: activeMemberships },
    { data: todaysShifts },
    { data: expiringMemberships },
    { data: monthlyFinancials },
    { data: gymHours },
    { data: employees },
  ] = await Promise.all([
    supabase.from('employees').select('*', { count: 'exact', head: true }).eq('active', true),
    supabase.from('members').select('*', { count: 'exact', head: true }).eq('active', true),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'new'),
    supabase.from('gym_settings').select('*').single(),
    supabase.from('active_memberships_count').select('*').single(),
    supabase.from('todays_shifts').select('*'),
    supabase.from('expiring_memberships').select('*').limit(10),
    supabase.from('monthly_financials').select('*').limit(3),
    supabase.from('gym_hours').select('*').order('day_of_week'),
    supabase.from('employees').select('id, name, role, hourly_rate, phone').eq('active', true),
  ])

  return { gymName: gymSettings?.gym_name, gymSettings, employeeCount, memberCount, newLeads: leadCount, activeMemberships, todaysShifts, expiringMemberships, monthlyFinancials, gymHours, employees }
}

const tools: Anthropic.Tool[] = [
  {
    name: 'search_members',
    description: 'Search members by name or phone',
    input_schema: { type: 'object' as const, properties: { query: { type: 'string' }, filter: { type: 'string', enum: ['expiring', 'active', 'all'] }, limit: { type: 'number' } }, required: [] },
  },
  {
    name: 'search_shifts',
    description: 'Get shifts for a date range or employee',
    input_schema: { type: 'object' as const, properties: { date_from: { type: 'string' }, date_to: { type: 'string' }, employee_id: { type: 'string' } }, required: [] },
  },
  {
    name: 'create_employee',
    description: 'Add a new employee',
    input_schema: { type: 'object' as const, properties: { name: { type: 'string' }, role: { type: 'string' }, hourly_rate: { type: 'number' }, phone: { type: 'string' }, email: { type: 'string' } }, required: ['name', 'role', 'hourly_rate'] },
  },
  {
    name: 'update_employee',
    description: 'Update an existing employee',
    input_schema: { type: 'object' as const, properties: { id: { type: 'string' }, name: { type: 'string' }, role: { type: 'string' }, hourly_rate: { type: 'number' }, phone: { type: 'string' }, email: { type: 'string' }, active: { type: 'boolean' } }, required: ['id'] },
  },
  {
    name: 'create_shift',
    description: 'Add a shift for an employee',
    input_schema: { type: 'object' as const, properties: { employee_id: { type: 'string' }, date: { type: 'string', description: 'YYYY-MM-DD' }, start_time: { type: 'string', description: 'HH:MM' }, end_time: { type: 'string', description: 'HH:MM' }, notes: { type: 'string' } }, required: ['employee_id', 'date', 'start_time', 'end_time'] },
  },
  {
    name: 'delete_shift',
    description: 'Delete a shift by ID',
    input_schema: { type: 'object' as const, properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'create_member',
    description: 'Add a new gym member',
    input_schema: { type: 'object' as const, properties: { name: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' }, date_of_birth: { type: 'string' }, notes: { type: 'string' } }, required: ['name'] },
  },
  {
    name: 'create_transaction',
    description: 'Record income or expense',
    input_schema: { type: 'object' as const, properties: { type: { type: 'string', description: 'income | expense' }, amount: { type: 'number' }, date: { type: 'string' }, description: { type: 'string' }, category_id: { type: 'string' } }, required: ['type', 'amount', 'date', 'description'] },
  },
  {
  name: 'get_financials',
  description: 'Get last 6 months financial data — income, expenses, profit',
  input_schema: { type: 'object' as const, properties: {}, required: [] },
 },
  {
    name: 'create_lead',
    description: 'Add a new lead',
    input_schema: { type: 'object' as const, properties: { name: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' }, source: { type: 'string' }, interest: { type: 'string' }, notes: { type: 'string' } }, required: ['name'] },
  },
  {
    name: 'update_gym_settings',
    description: 'Update gym settings',
    input_schema: { type: 'object' as const, properties: { gym_name: { type: 'string' }, address: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' }, website: { type: 'string' } }, required: [] },
  },
  {
    name: 'update_gym_hours',
    description: 'Update opening/closing hours for a specific day',
    input_schema: { type: 'object' as const, properties: { day_of_week: { type: 'number', description: '0=Monday, 6=Sunday' }, open_time: { type: 'string', description: 'HH:MM' }, close_time: { type: 'string', description: 'HH:MM' }, is_closed: { type: 'boolean' } }, required: ['day_of_week'] },
  },
]

async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case 'search_members': {
        let query = supabase.from('members').select('id, name, phone, email, active')
        if (input.query) query = query.or(`name.ilike.%${input.query}%,phone.ilike.%${input.query}%`)
        if (input.filter === 'active') query = query.eq('active', true)
        const { data } = await query.limit((input.limit as number) || 20)
        return JSON.stringify(data || [])
      }
      case 'search_shifts': {
        let query = supabase.from('shifts').select('*, employees(name, role)')
        if (input.date_from) query = query.gte('date', input.date_from as string)
        if (input.date_to) query = query.lte('date', input.date_to as string)
        if (input.employee_id) query = query.eq('employee_id', input.employee_id as string)
        const { data } = await query.order('date').limit(100)
        return JSON.stringify(data || [])
      }
      case 'create_employee': {
        const { data, error } = await supabase.from('employees').insert([input]).select().single()
        if (error) throw error
        return `✅ Служителят "${input.name}" е добавен успешно. ID: ${data.id}`
      }
      case 'update_employee': {
        const { id, ...updates } = input
        const { error } = await supabase.from('employees').update(updates).eq('id', id)
        if (error) throw error
        return `✅ Служителят е обновен успешно.`
      }
      case 'create_shift': {
        const { data, error } = await supabase.from('shifts').insert([input]).select().single()
        if (error) throw error
        return `✅ Смяната е добавена успешно. ID: ${data.id}`
      }
      case 'delete_shift': {
        const { error } = await supabase.from('shifts').delete().eq('id', input.id)
        if (error) throw error
        return `✅ Смяната е изтрита успешно.`
      }
      case 'create_member': {
        const { data, error } = await supabase.from('members').insert([input]).select().single()
        if (error) throw error
        return `✅ Членът "${input.name}" е добавен успешно. ID: ${data.id}`
      }
      case 'create_transaction': {
        const { data, error } = await supabase.from('transactions').insert([input]).select().single()
        if (error) throw error
        return `✅ Транзакцията е записана. ID: ${data.id}`
      }
      case 'create_lead': {
        const { data, error } = await supabase.from('leads').insert([input]).select().single()
        if (error) throw error
        return `✅ Лийдът "${input.name}" е добавен. ID: ${data.id}`
      }
      case 'update_gym_settings': {
        const { data: existing } = await supabase.from('gym_settings').select('id').single()
        if (existing) await supabase.from('gym_settings').update({ ...input, updated_at: new Date().toISOString() }).eq('id', existing.id)
        return `✅ Настройките на gym-а са обновени.`
      }
      case 'update_gym_hours': {
        const { day_of_week, ...updates } = input
        const { error } = await supabase.from('gym_hours').update(updates).eq('day_of_week', day_of_week)
        if (error) throw error
        return `✅ Работното време е обновено успешно.`
      }
      case 'get_financials': {
  const { data } = await supabase.from('monthly_financials').select('*').limit(6)
  return JSON.stringify(data || [])
   }default:
        return `❌ Непознат инструмент: ${name}`
    }
  } catch (err) {
    return `❌ Грешка: ${err instanceof Error ? err.message : String(err)}`
  }
}

export async function POST(req: NextRequest) {
  const { message, history = [] } = await req.json()

  const gymData = await getGymContextSummary()

  const systemPrompt = `You are the AI business assistant for ${gymData.gymName || 'Vitality Gym'}.
You have full access to the gym database and can both READ and WRITE data.

IMPORTANT RULES:
- Always respond in the same language the user writes in (Bulgarian or English)
- Before creating/updating anything, confirm with the user if it's not 100% clear
- When you use a tool, briefly explain what you did
- Be concise and professional
- For shifts: use employee IDs from the employees list below
- Use search_members to look up members when needed
- Use search_shifts to look up shifts when needed
- Today's date is: ${new Date().toISOString().split('T')[0]}

Gym summary:
${JSON.stringify({
    gymName: gymData.gymName,
    gymSettings: gymData.gymSettings,
    stats: { employees: gymData.employeeCount, members: gymData.memberCount, newLeads: gymData.newLeads, activeMemberships: gymData.activeMemberships },
    todaysShifts: gymData.todaysShifts,
    expiringMemberships: gymData.expiringMemberships,
    monthlyFinancials: gymData.monthlyFinancials,
    gymHours: gymData.gymHours,
    employees: gymData.employees,
  })}`

  const messages: Anthropic.MessageParam[] = [...history, { role: 'user', content: message }]

  let response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: systemPrompt,
    tools,
    messages,
  })

  const assistantMessages: Anthropic.MessageParam[] = []

  while (response.stop_reason === 'tool_use') {
    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[]
    const toolResults: Anthropic.ToolResultBlockParam[] = []

    for (const toolUse of toolUseBlocks) {
      const result = await executeTool(toolUse.name, toolUse.input as Record<string, unknown>)
      toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: result })
    }

    assistantMessages.push({ role: 'assistant', content: response.content })
    assistantMessages.push({ role: 'user', content: toolResults })

    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      tools,
      messages: [...messages, ...assistantMessages],
    })
  }

  const text = response.content.filter(b => b.type === 'text').map(b => (b as Anthropic.TextBlock).text).join('\n')

  return NextResponse.json({
    response: text,
    history: [...history, { role: 'user', content: message }, { role: 'assistant', content: text }]
  })
}