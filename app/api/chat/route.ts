// app/api/chat/route.ts
// AI assistant with agentic tool use. Only queries tables that actually exist.
import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { GYM_ID } from '@/lib/constants'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// Build gym context from real tables only
async function getGymContextSummary() {
  const today = new Date().toISOString().split('T')[0]
  const thisMonth = today.substring(0, 7) + '-01'

  const [
    { count: employeeCount },
    { data: gymSettings },
    { data: employees },
    { data: todaysShifts },
    { data: recentDeliveries },
    { data: pendingRequests },
    { data: recentCash },
    { data: ptClients },
    { data: ptSessions },
  ] = await Promise.all([
    supabase.from('employees').select('*', { count: 'exact', head: true }).eq('active', true),
    supabase.from('gym_settings').select('weekday_open, weekday_close, saturday_open, saturday_close, sunday_open, sunday_close').eq('gym_id', GYM_ID).single(),
    supabase.from('employees').select('id, name, role, phone').eq('active', true).order('name'),
    supabase.from('shifts').select('*, employees(name, role)').eq('date', today),
    supabase.from('deliveries').select('supplier_name, invoice_date, total_amount, status').eq('gym_id', GYM_ID).order('invoice_date', { ascending: false }).limit(5),
    supabase.from('delivery_requests').select('month, status, created_by').eq('gym_id', GYM_ID).eq('status', 'submitted').limit(5),
    supabase.from('daily_cash').select('date, staff_name, gym_cash_counted, hall_cash_counted, alert_physical_diff').eq('gym_id', GYM_ID).order('date', { ascending: false }).limit(7),
    supabase.from('pt_clients').select('id, name, active, instructor:employees(name)').eq('gym_id', GYM_ID).limit(20),
    supabase.from('pt_sessions').select('scheduled_at, status, client:pt_clients(name), instructor:employees(name)').eq('gym_id', GYM_ID).gte('scheduled_at', thisMonth).order('scheduled_at').limit(10),
  ])

  return {
    gymSettings,
    employeeCount,
    employees: employees || [],
    todaysShifts: todaysShifts || [],
    recentDeliveries: recentDeliveries || [],
    pendingRequests: pendingRequests || [],
    recentCash: recentCash || [],
    ptClients: ptClients || [],
    ptSessionsThisMonth: ptSessions || [],
  }
}

const tools: Anthropic.Tool[] = [
  {
    name: 'search_employees',
    description: 'Search employees by name or role. Returns id, name, role, phone, email, active status.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Name or role to search for' },
        active_only: { type: 'boolean', description: 'Return only active employees' },
      },
      required: [],
    },
  },
  {
    name: 'search_shifts',
    description: 'Get shifts for a date range or specific employee.',
    input_schema: {
      type: 'object' as const,
      properties: {
        date_from: { type: 'string', description: 'YYYY-MM-DD' },
        date_to: { type: 'string', description: 'YYYY-MM-DD' },
        employee_id: { type: 'string' },
      },
      required: [],
    },
  },
  {
    name: 'create_employee',
    description: 'Add a new employee to the system.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string' },
        role: { type: 'string', description: 'Reception, instructor, cleaning, or admin' },
        hourly_rate: { type: 'number' },
        phone: { type: 'string' },
        email: { type: 'string' },
      },
      required: ['name', 'role'],
    },
  },
  {
    name: 'update_employee',
    description: 'Update employee details (name, role, phone, active status, etc.)',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        role: { type: 'string' },
        hourly_rate: { type: 'number' },
        phone: { type: 'string' },
        email: { type: 'string' },
        active: { type: 'boolean' },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_shift',
    description: 'Add a shift for an employee.',
    input_schema: {
      type: 'object' as const,
      properties: {
        employee_id: { type: 'string' },
        date: { type: 'string', description: 'YYYY-MM-DD' },
        start_time: { type: 'string', description: 'HH:MM' },
        end_time: { type: 'string', description: 'HH:MM' },
        shift_type: { type: 'string', description: 'ПЪРВА, ВТОРА, or ЦЯЛ ДЕН' },
        notes: { type: 'string' },
      },
      required: ['employee_id', 'date', 'start_time', 'end_time'],
    },
  },
  {
    name: 'delete_shift',
    description: 'Delete a shift by ID.',
    input_schema: {
      type: 'object' as const,
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'get_deliveries',
    description: 'Get recent deliveries with items. Can filter by supplier or month.',
    input_schema: {
      type: 'object' as const,
      properties: {
        month: { type: 'string', description: 'YYYY-MM to filter by month' },
        supplier: { type: 'string', description: 'Supplier name filter' },
        status: { type: 'string', description: 'pending, approved, or rejected' },
        limit: { type: 'number' },
      },
      required: [],
    },
  },
  {
    name: 'get_cash_records',
    description: 'Get daily cash reconciliation records.',
    input_schema: {
      type: 'object' as const,
      properties: {
        date_from: { type: 'string', description: 'YYYY-MM-DD' },
        date_to: { type: 'string', description: 'YYYY-MM-DD' },
        alerts_only: { type: 'boolean', description: 'Only return records with anomalies' },
      },
      required: [],
    },
  },
  {
    name: 'get_pt_sessions',
    description: 'Get PT (personal training) sessions for a date range or instructor.',
    input_schema: {
      type: 'object' as const,
      properties: {
        date_from: { type: 'string', description: 'YYYY-MM-DD' },
        date_to: { type: 'string', description: 'YYYY-MM-DD' },
        instructor_id: { type: 'string' },
        status: { type: 'string', description: 'scheduled, completed, cancelled_early, cancelled_late, no_show' },
      },
      required: [],
    },
  },
  {
    name: 'get_notes',
    description: 'Get notes from the briefing board.',
    input_schema: {
      type: 'object' as const,
      properties: {
        priority: { type: 'string', description: 'urgent, normal, or info' },
        pinned_only: { type: 'boolean' },
      },
      required: [],
    },
  },
]

async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case 'search_employees': {
        let query = supabase.from('employees').select('id, name, role, phone, email, active, hire_date')
        if (input.query) query = query.or(`name.ilike.%${input.query}%,role.ilike.%${input.query}%`)
        if (input.active_only) query = query.eq('active', true)
        const { data } = await query.order('name').limit(20)
        return JSON.stringify(data || [])
      }

      case 'search_shifts': {
        let query = supabase.from('shifts').select('*, employees(name, role)')
        if (input.date_from) query = query.gte('date', input.date_from as string)
        if (input.date_to) query = query.lte('date', input.date_to as string)
        if (input.employee_id) query = query.eq('staff_id', input.employee_id as string)
        const { data } = await query.order('date').limit(100)
        return JSON.stringify(data || [])
      }

      case 'create_employee': {
        const { data, error } = await supabase
          .from('employees')
          .insert([{ ...input, active: true }])
          .select('id, name, role')
          .single()
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
        const { data, error } = await supabase
          .from('shifts')
          .insert([{ staff_id: input.employee_id, ...input }])
          .select('id')
          .single()
        if (error) throw error
        return `✅ Смяната е добавена успешно. ID: ${data.id}`
      }

      case 'delete_shift': {
        const { error } = await supabase.from('shifts').delete().eq('id', input.id)
        if (error) throw error
        return `✅ Смяната е изтрита успешно.`
      }

      case 'get_deliveries': {
        let query = supabase
          .from('deliveries')
          .select('supplier_name, invoice_number, invoice_date, total_amount, status, delivery_items(product_name, quantity, unit, unit_price, category)')
          .eq('gym_id', GYM_ID)
        if (input.month) query = query.like('invoice_date', `${input.month}%`)
        if (input.supplier) query = query.ilike('supplier_name', `%${input.supplier}%`)
        if (input.status) query = query.eq('status', input.status)
        const { data } = await query.order('invoice_date', { ascending: false }).limit((input.limit as number) || 20)
        return JSON.stringify(data || [])
      }

      case 'get_cash_records': {
        let query = supabase.from('daily_cash').select('date, staff_name, gym_cash_system, gym_cash_counted, hall_cash_system, hall_cash_counted, deposit, admin_cash_counted, alert_physical_diff, alert_system_diff, notes').eq('gym_id', GYM_ID)
        if (input.date_from) query = query.gte('date', input.date_from as string)
        if (input.date_to) query = query.lte('date', input.date_to as string)
        if (input.alerts_only) query = query.or('alert_physical_diff.eq.true,alert_system_diff.eq.true')
        const { data } = await query.order('date', { ascending: false }).limit(30)
        return JSON.stringify(data || [])
      }

      case 'get_pt_sessions': {
        let query = supabase
          .from('pt_sessions')
          .select('scheduled_at, duration_minutes, session_type, status, location, notes, client:pt_clients(name), instructor:employees(name)')
          .eq('gym_id', GYM_ID)
        if (input.date_from) query = query.gte('scheduled_at', input.date_from as string)
        if (input.date_to) query = query.lte('scheduled_at', `${input.date_to}T23:59:59`)
        if (input.instructor_id) query = query.eq('instructor_id', input.instructor_id as string)
        if (input.status) query = query.eq('status', input.status)
        const { data } = await query.order('scheduled_at').limit(50)
        return JSON.stringify(data || [])
      }

      case 'get_notes': {
        let query = supabase.from('notes').select('title, content, priority, pinned, expires_at, author_name, created_at').eq('gym_id', GYM_ID)
        if (input.priority) query = query.eq('priority', input.priority)
        if (input.pinned_only) query = query.eq('pinned', true)
        const { data } = await query.order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(20)
        return JSON.stringify(data || [])
      }

      default:
        return `❌ Непознат инструмент: ${name}`
    }
  } catch (err) {
    return `❌ Грешка при изпълнение на ${name}: ${err instanceof Error ? err.message : String(err)}`
  }
}

export async function POST(req: NextRequest) {
  try {
    const { message, history = [] } = await req.json()

    // Gracefully handle context fetch errors — don't crash the whole chat
    let gymData
    try {
      gymData = await getGymContextSummary()
    } catch (err) {
      console.error('[chat] Context fetch failed:', err)
      gymData = { gymSettings: null, employeeCount: 0, employees: [], todaysShifts: [], recentDeliveries: [], pendingRequests: [], recentCash: [], ptClients: [], ptSessionsThisMonth: [] }
    }

    const systemPrompt = `Ти си AI асистент на Vitality Gym, Пловдив, България.
Имаш достъп до данните на фитнеса и можеш да четеш информация чрез инструментите.

ВАЖНИ ПРАВИЛА:
- Отговаряй на езика на потребителя (български или английски)
- Преди да създадеш/обновиш нещо, потвърди ако не е 100% ясно
- Когато използваш инструмент, кажи накратко какво правиш
- Бъди кратък и професионален
- Днешна дата: ${new Date().toISOString().split('T')[0]}

Текущо резюме на фитнеса:
- Активни служители: ${gymData.employeeCount}
- Служители: ${gymData.employees.map((e: Record<string, unknown>) => `${e.name} (${e.role})`).join(', ')}
- Смени днес: ${gymData.todaysShifts.length > 0 ? gymData.todaysShifts.map((s: Record<string, unknown>) => `${(s.employees as Record<string, unknown>)?.name} ${s.start_time}-${s.end_time}`).join(', ') : 'Няма'}
- Последни доставки: ${gymData.recentDeliveries.map((d: Record<string, unknown>) => `${d.supplier_name} ${d.invoice_date} (${d.total_amount}€, ${d.status})`).join(' | ')}
- Чакащи заявки: ${gymData.pendingRequests.length}
- PT клиенти: ${gymData.ptClients.length}
- Работно време: Пон-Пет ${gymData.gymSettings?.weekday_open}-${gymData.gymSettings?.weekday_close}, Саб ${gymData.gymSettings?.saturday_open}-${gymData.gymSettings?.saturday_close}

За повече детайли използвай инструментите.`

    const messages: Anthropic.MessageParam[] = [...history, { role: 'user', content: message }]

    let response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2048,
      system: systemPrompt,
      tools,
      messages,
    })

    const assistantMessages: Anthropic.MessageParam[] = []

    // Agentic loop — max 5 rounds to prevent runaway tool calls
    let rounds = 0
    while (response.stop_reason === 'tool_use' && rounds < 5) {
      rounds++
      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[]
      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const toolUse of toolUseBlocks) {
        const result = await executeTool(toolUse.name, toolUse.input as Record<string, unknown>)
        toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: result })
      }

      assistantMessages.push({ role: 'assistant', content: response.content })
      assistantMessages.push({ role: 'user', content: toolResults })

      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2048,
        system: systemPrompt,
        tools,
        messages: [...messages, ...assistantMessages],
      })
    }

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as Anthropic.TextBlock).text)
      .join('\n')

    return NextResponse.json({
      response: text,
      history: [...history, { role: 'user', content: message }, { role: 'assistant', content: text }],
    })
  } catch (err) {
    console.error('[chat error]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
