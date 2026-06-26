import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/db/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { lat, lng, userId, address } = body

    if (!lat || !lng || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createServiceClient()
    
    // Save the location as a PostGIS POINT Geography
    const { error } = await supabase
      .from('profiles')
      .update({
        home_location: `POINT(${lng} ${lat})`,
        home_address: address || null
      })
      .eq('id', userId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error setting home location:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
