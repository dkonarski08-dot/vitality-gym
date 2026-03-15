// app/api/__tests__/service-types-security.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeReq } from './helpers'

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'st-1', name: 'Test', price: 10, category: 'A', business_unit: 'gym', integration_type: 'service_record', active: true, gym_id: 'g-1', duration_days: null, created_at: '' }, error: null }),
    })),
  },
}))

const BASE = 'http://localhost'

describe('GET /api/service-types', () => {
  beforeEach(() => vi.resetModules())

  it('no session → 401', async () => {
    const { GET } = await import('../service-types/route')
    expect((await GET(makeReq(null, 'GET', `${BASE}/api/service-types`))).status).toBe(401)
  })

  it('instructor → 403', async () => {
    const { GET } = await import('../service-types/route')
    expect((await GET(makeReq('instructor', 'GET', `${BASE}/api/service-types`))).status).toBe(403)
  })

  it('receptionist → 200', async () => {
    const { GET } = await import('../service-types/route')
    expect((await GET(makeReq('receptionist', 'GET', `${BASE}/api/service-types`))).status).toBe(200)
  })
})

describe('POST /api/service-types — admin only', () => {
  beforeEach(() => vi.resetModules())

  it('receptionist → 403', async () => {
    const { POST } = await import('../service-types/route')
    const res = await POST(makeReq('receptionist', 'POST', `${BASE}/api/service-types`, {
      action: 'create', name: 'X', price: 10, category: 'A', business_unit: 'gym', integration_type: 'service_record'
    }))
    expect(res.status).toBe(403)
  })

  it('no session → 401', async () => {
    const { POST } = await import('../service-types/route')
    expect((await POST(makeReq(null, 'POST', `${BASE}/api/service-types`, { action: 'create' }))).status).toBe(401)
  })

  it('admin → 200', async () => {
    const { POST } = await import('../service-types/route')
    const res = await POST(makeReq('admin', 'POST', `${BASE}/api/service-types`, {
      action: 'create', name: 'X', price: 10, category: 'A', business_unit: 'gym', integration_type: 'service_record'
    }))
    expect(res.status).toBe(200)
  })
})
