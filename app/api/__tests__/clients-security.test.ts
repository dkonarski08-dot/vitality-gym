// app/api/__tests__/clients-security.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeReq } from './helpers'

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'c-1', name: 'Test', phone: '123', discount_tier: 'none', gym_id: 'g-1', notes: null, created_at: '' }, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}))

const BASE = 'http://localhost'

describe('GET /api/clients', () => {
  beforeEach(() => vi.resetModules())

  it('no session → 401', async () => {
    const { GET } = await import('../clients/route')
    const res = await GET(makeReq(null, 'GET', `${BASE}/api/clients?q=test`))
    expect(res.status).toBe(401)
  })

  it('instructor → 403', async () => {
    const { GET } = await import('../clients/route')
    const res = await GET(makeReq('instructor', 'GET', `${BASE}/api/clients?q=test`))
    expect(res.status).toBe(403)
  })

  it('receptionist → 200', async () => {
    const { GET } = await import('../clients/route')
    const res = await GET(makeReq('receptionist', 'GET', `${BASE}/api/clients?q=test`))
    expect(res.status).toBe(200)
  })

  it('admin → 200', async () => {
    const { GET } = await import('../clients/route')
    const res = await GET(makeReq('admin', 'GET', `${BASE}/api/clients?q=test`))
    expect(res.status).toBe(200)
  })
})

describe('POST /api/clients', () => {
  beforeEach(() => vi.resetModules())

  it('no session → 401', async () => {
    const { POST } = await import('../clients/route')
    const res = await POST(makeReq(null, 'POST', `${BASE}/api/clients`, { name: 'A', phone: '123' }))
    expect(res.status).toBe(401)
  })

  it('instructor → 403', async () => {
    const { POST } = await import('../clients/route')
    const res = await POST(makeReq('instructor', 'POST', `${BASE}/api/clients`, { name: 'A', phone: '123' }))
    expect(res.status).toBe(403)
  })

  it('receptionist → 200', async () => {
    const { POST } = await import('../clients/route')
    const res = await POST(makeReq('receptionist', 'POST', `${BASE}/api/clients`, { name: 'A', phone: '123' }))
    expect(res.status).toBe(200)
  })
})
