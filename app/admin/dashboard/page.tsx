import { createServerSupabaseClient } from '@/lib/db/server'
import { redirect } from 'next/navigation'
import { AdminDashboardClient } from '@/components/admin/AdminDashboardClient'

export default async function AdminDashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?role=admin')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Guard: Must be admin
  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  // Fetch all issues (for municipal view, we fetch all issues)
  const { data: issues } = await supabase
    .from('issues')
    .select('*')
    .order('created_at', { ascending: false })

  const { data: departments } = await supabase
    .from('departments')
    .select('*')

  return (
    <AdminDashboardClient
      user={user}
      profile={profile}
      initialIssues={issues || []}
      departments={departments || []}
    />
  )
}
