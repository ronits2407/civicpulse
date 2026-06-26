import { createServerSupabaseClient } from '@/lib/db/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  const role = searchParams.get('role')

  if (code) {
    const supabase = await createServerSupabaseClient()
    const { error, data } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      if (role === 'admin' && data?.user) {
        // Update user profile to admin
        await supabase.from('profiles').update({ role: 'admin' }).eq('id', data.user.id)
        return NextResponse.redirect(`${origin}/admin/dashboard`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=callback_failed`)
}