// app/api/notes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { serverError } from '@/lib/serverError'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const role = searchParams.get('role') || 'admin'
    const limit = parseInt(searchParams.get('limit') || '50')

    // Fetch notes visible to this role, not expired
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .contains('visible_to', [role])
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return NextResponse.json({ notes: data || [] })
  } catch (err) {
    return serverError('notes GET', err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    // ── Delete note ──
    if (action === 'delete') {
      const { id } = body
      if (!id) return NextResponse.json({ error: 'Липсва ID' }, { status: 400 })
      const { error } = await supabase.from('notes').delete().eq('id', id)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    // ── Toggle pin ──
    if (action === 'toggle_pin') {
      const { id, pinned } = body
      const { error } = await supabase
        .from('notes')
        .update({ pinned, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    // ── Create note ──
    const { author_name, author_role, title, content, priority, pinned, expires_at, visible_to } = body

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Съдържанието е задължително' }, { status: 400 })
    }

    // Ensure visible_to is always a proper Postgres array
    // Default: visible to everyone if not specified
    let roles = visible_to
    if (!roles || !Array.isArray(roles) || roles.length === 0) {
      roles = ['admin', 'receptionist', 'instructor']
    }

    const { data, error } = await supabase
      .from('notes')
      .insert([{
        author_name: author_name || 'Unknown',
        author_role: author_role || 'admin',
        title: title?.trim() || null,
        content: content.trim(),
        priority: priority || 'normal',
        pinned: pinned || false,
        expires_at: expires_at || null,
        visible_to: roles,
      }])
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, note: data })
  } catch (err) {
    return serverError('notes POST', err)
  }
}