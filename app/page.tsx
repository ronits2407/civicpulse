import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/db/server'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function HomePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-5xl font-bold text-foreground mb-4 tracking-tight">CivicPulse</h1>
      <p className="text-muted-foreground text-lg max-w-md mb-8">
        AI-powered civic issue reporting. Report problems, track resolutions, build a better city.
      </p>
      <div className="flex gap-4">
        <Link href="/auth/login">
          <Button className="bg-[#2da44e] hover:bg-[#2c974b] text-white border border-[#2da44e] px-8 h-10 font-semibold shadow-sm">
            Get Started
          </Button>
        </Link>
        <Link href="/admin/login">
          <Button variant="outline" className="text-foreground hover:bg-accent border-border px-8 h-10 font-semibold shadow-sm">
            Admin Login
          </Button>
        </Link>
      </div>
    </div>
  )
}