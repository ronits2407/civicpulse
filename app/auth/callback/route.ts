import { createServerSupabaseClient } from '@/lib/db/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  const role = searchParams.get('role')
  
  // Use NEXT_PUBLIC_APP_URL to construct absolute redirect URLs correctly, 
  // bypassing Docker host resolution issues where origin might be 0.0.0.0
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL

  if (code) {
    const supabase = await createServerSupabaseClient()
    const { error, data } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      if (role === 'admin' && data?.user) {
        // Update user profile to admin
        await supabase.from('profiles').update({ role: 'admin' }).eq('id', data.user.id)
        return NextResponse.redirect(`${baseUrl}/admin/dashboard`)
      }
      return NextResponse.redirect(`${baseUrl}${next}`)
    }
  }

  return NextResponse.redirect(`${baseUrl}/auth/login?error=callback_failed`)
}