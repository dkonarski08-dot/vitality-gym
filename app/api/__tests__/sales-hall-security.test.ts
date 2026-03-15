// app/api/__tests__/sales-hall-security.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeReq } from './helpers'

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    })),
  },
}))

const BASE = 'http://localhost'

describe('GET /api/sales?business_unit=hall — admin only', () => {
  beforeEach(() => vi.resetModules())

  it('receptionist → 403 when requesting hall data', async () => {
    const { GET } = await import('../sales/route')
    const res = await GET(makeReq('receptionist', 'GET', `${BASE}/api/sales?business_unit=hall`))
    expect(res.status).toBe(403)
  })

  it('admin → 200 for hall data', async () => {
    const { GET } = await import('../sales/route')
    const res = await GET(makeReq('admin', 'GET', `${BASE}/api/sales?business_unit=hall`))
    expect(res.status).toBe(200)
  })
})
