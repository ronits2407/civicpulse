import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'set' : 'missing',
    geminiKey: process.env.GEMINI_API_KEY ? 'set' : 'missing',
    mapsKey: process.env.GOOGLE_MAPS_API_KEY ? 'set' : 'missing',
    mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN ? 'set' : 'missing',
  })
}