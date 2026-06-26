import { createServerSupabaseClient } from '@/lib/db/server'
import { redirect } from 'next/navigation'
import { DashboardClient } from '@/components/dashboard/DashboardClient'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: issues } = await supabase
    .from('issues')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const { data: departments } = await supabase
    .from('departments')
    .select('*')

  return (
    <DashboardClient
      user={user}
      profile={profile}
      initialIssues={issues || []}
      departments={departments || []}
    />
  )
}