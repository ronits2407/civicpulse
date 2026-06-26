import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')

  if (!lat || !lng) {
    return NextResponse.json({ error: 'Missing coordinates' }, { status: 400 })
  }

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${process.env.GOOGLE_MAPS_API_KEY}`
    )
    const data = await res.json()
    
    let address = `${lat}, ${lng}`
    
    if (data.results && data.results.length > 0) {
      const components = data.results[0].address_components || []
      
      let city = ''
      let state = ''

      for (const comp of components) {
        const types = comp.types || []
        if (!city && (types.includes('locality') || types.includes('sublocality') || types.includes('administrative_area_level_3') || types.includes('administrative_area_level_2'))) {
          city = comp.long_name
        }
        if (types.includes('administrative_area_level_1')) {
          state = comp.long_name
        }
      }

      if (city && state && city !== state) {
        address = `${city}, ${state}`
      } else if (city || state) {
        address = city || state
      } else {
        // Fallback: use formatted_address but regex out the Plus Code if it exists at the start
        address = data.results[0].formatted_address.replace(/^[A-Z0-9]{2,8}\+[A-Z0-9]{2,3}[^,]*,?\s*/, '')
      }
    }
    
    return NextResponse.json({ address })
  } catch (err) {
    return NextResponse.json({ error: 'Geocoding failed', address: `${lat}, ${lng}` }, { status: 500 })
  }
}
