import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/db/server'

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { origin, waypoints } = await req.json()
    if (!origin || !waypoints || waypoints.length === 0) {
      return NextResponse.json({ error: 'Missing origin or waypoints' }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Google Maps API key not configured' }, { status: 500 })
    }

    // Google Maps Routes API Request format
    const requestBody = {
      origin: {
        location: {
          latLng: {
            latitude: origin.lat,
            longitude: origin.lng
          }
        }
      },
      destination: {
        // Round trip: return to origin
        location: {
          latLng: {
            latitude: origin.lat,
            longitude: origin.lng
          }
        }
      },
      intermediates: waypoints.map((wp: any) => ({
        location: {
          latLng: {
            latitude: wp.lat,
            longitude: wp.lng
          }
        }
      })),
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_UNAWARE',
      optimizeWaypointOrder: true, // TSP Optimization
    }

    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.optimizedIntermediateWaypointIndex'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Google Maps API Error:', err)
      return NextResponse.json({ error: 'Failed to compute route from Google Maps' }, { status: 500 })
    }

    const data = await response.json()
    const route = data.routes?.[0]
    if (!route) {
      return NextResponse.json({ error: 'No route found' }, { status: 404 })
    }

    return NextResponse.json({
      distanceMeters: route.distanceMeters,
      duration: route.duration, // e.g. "1200s"
      encodedPolyline: route.polyline?.encodedPolyline,
      optimizedWaypointIndices: route.optimizedIntermediateWaypointIndex || []
    })

  } catch (error: any) {
    console.error('Route Optimization error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
