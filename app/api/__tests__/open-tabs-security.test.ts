// app/api/__tests__/open-tabs-security.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeReq } from './helpers'

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'tab-1', items: [], total_amount: 10, has_services: false, gym_id: 'g-1', business_unit: 'gym', discount_amount: 0, created_by: 'Test', created_at: '', client_id: null }, error: null }),
    })),
  },
}))

const BASE = 'http://localhost'

describe('GET /api/open-tabs', () => {
  beforeEach(() => vi.resetModules())

  it('no session → 401', async () => {
    const { GET } = await import('../open-tabs/route')
    expect((await GET(makeReq(null, 'GET', `${BASE}/api/open-tabs`))).status).toBe(401)
  })

  it('instructor → 403', async () => {
    const { GET } = await import('../open-tabs/route')
    expect((await GET(makeReq('instructor', 'GET', `${BASE}/api/open-tabs`))).status).toBe(403)
  })

  it('receptionist → 200', async () => {
    const { GET } = await import('../open-tabs/route')
    expect((await GET(makeReq('receptionist', 'GET', `${BASE}/api/open-tabs`))).status).toBe(200)
  })
})

describe('POST /api/open-tabs — delete (admin only)', () => {
  beforeEach(() => vi.resetModules())

  it('receptionist cannot delete → 403', async () => {
    const { POST } = await import('../open-tabs/route')
    const res = await POST(makeReq('receptionist', 'POST', `${BASE}/api/open-tabs`, { action: 'delete_tab', tab_id: 'tab-1' }))
    expect(res.status).toBe(403)
  })
})
