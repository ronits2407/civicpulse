import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/db/server'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function HomePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-5xl font-bold text-white mb-4">CivicPulse</h1>
      <p className="text-slate-400 text-lg max-w-md mb-8">
        AI-powered civic issue reporting. Report problems, track resolutions, build a better city.
      </p>
      <div className="flex gap-4">
        <Link href="/auth/login">
          <Button className="bg-blue-600 hover:bg-blue-700 px-8 h-12">
            Get Started
          </Button>
        </Link>
        <Link href="/admin/login">
          <Button variant="outline" className="border-slate-700 text-white hover:bg-slate-800 px-8 h-12">
            Admin Login
          </Button>
        </Link>
      </div>
    </div>
  )
}