'use server'

import { createServerSupabaseClient } from '@/lib/db/server'
import { redirect } from 'next/navigation'

export async function signInWithGoogle(formData: FormData) {
  const role = formData.get('role') as string
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?role=${role || 'citizen'}`,
    },
  })

  if (error) redirect('/auth/login?error=oauth_failed')
  if (data.url) redirect(data.url)
}

export async function signInWithEmail(email: string, role: string = 'citizen') {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?role=${role}`,
    },
  })

  if (error) return { error: error.message }
  return { success: true }
}

export async function signOut() {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  redirect('/')
}

export async function getUser() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function getUserProfile(userId: string) {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return data
}
