import { createBrowserClient } from '@supabase/ssr'

/**
 * Browser-only Supabase client.
 * Safe to import in Client Components ('use client').
 * Never imports next/headers — no server-only APIs here.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}