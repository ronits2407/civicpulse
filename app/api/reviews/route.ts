import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/db/server'
import wkx from 'wkx'

// Haversine distance in meters
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Get user's home location
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('home_location')
      .eq('id', userId)
      .single()

    if (profileError || !profile || !profile.home_location) {
      return NextResponse.json({ issues: [] }) // No home location set
    }

    // Attempt to extract lat/lng if returned as GeoJSON point or WKB
    // But since we just want it to work regardless of PostgREST config, we will use a raw RPC or try to parse
    // Wait, simpler: we can just ask Supabase to do the distance check!
    // But since we already have the Issues, let's just use an RPC if available, or fetch lat/lng via a view.
    // Actually, `issues_within_radius` expects a radius, we can just use the Haversine in JS if we stored lat/lng...
    // Let's assume profile.home_location is returned as WKB hex string. Parsing it is hard.
    
    // Instead of doing it in JS, let's use the PostGIS ST_Distance function in a raw query using rpc, but if we don't have rpc, we can fetch lat and lng using a quick select.
    const { data: coordsData, error: coordsError } = await supabase
      .from('profiles')
      .select('id, location:home_location')
      .eq('id', userId)
      .single()
      
    // Actually, let's just require the frontend to pass lat/lng when it fetches, OR we can extract it from the user's browser geolocation if they click "fetch".
    // Wait, let's just make the frontend pass it. But the frontend doesn't store it.
    // Let's modify the profile table to also store `home_lat` and `home_lng` explicitly to make this easy. No, that requires another schema change.
    // Let's see if we can parse the PostGIS point. A PostGIS point in JSON from Supabase is typically a string like "POINT(73.8567 18.5204)" or GeoJSON { type: "Point", coordinates: [73.8567, 18.5204] }.
    let lat = 0;
    let lng = 0;
    
    if (typeof profile.home_location === 'string') {
      if (profile.home_location.startsWith('POINT')) {
        const match = profile.home_location.match(/POINT\(([-\d.]+) ([-\d.]+)\)/);
        if (match) {
          lng = parseFloat(match[1]);
          lat = parseFloat(match[2]);
        }
      } else {
        // Parse hex WKB string
        try {
          const geom = wkx.Geometry.parse(Buffer.from(profile.home_location, 'hex')) as any;
          if (geom.x && geom.y) {
            lng = geom.x;
            lat = geom.y;
          }
        } catch (e) {
          console.error('Failed to parse home_location WKB:', e)
        }
      }
    } else if (profile.home_location?.type === 'Point' && Array.isArray(profile.home_location.coordinates)) {
      lng = profile.home_location.coordinates[0];
      lat = profile.home_location.coordinates[1];
    }
    
    if (!lat || !lng) {
       return NextResponse.json({ issues: [] })
    }


    // 1. Fetch all issues in community_review
    const { data: issues, error } = await supabase
      .from('issues')
      .select('*')
      .eq('status', 'community_review')

    if (error) throw error

    // 2. Fetch verifications by this user to exclude ones they already voted on
    const { data: userVotes, error: votesError } = await supabase
      .from('verifications')
      .select('issue_id')
      .eq('user_id', userId)
      
    if (votesError) throw votesError

    const votedIssueIds = new Set(userVotes.map(v => v.issue_id))

    // 3. Filter issues
    const nearbyIssues = issues.filter(issue => {
      // Don't show reporter their own issue
      if (issue.user_id === userId) return false
      // Don't show issues they already voted on
      if (votedIssueIds.has(issue.id)) return false
      
      // Check distance (1km radius)
      let issueLat = 0
      let issueLng = 0

      if (typeof issue.location === 'string') {
        if (issue.location.startsWith('POINT')) {
          const match = issue.location.match(/POINT\(([-\d.]+) ([-\d.]+)\)/)
          if (match) {
            issueLng = parseFloat(match[1])
            issueLat = parseFloat(match[2])
          }
        } else {
          try {
            const geom = wkx.Geometry.parse(Buffer.from(issue.location, 'hex')) as any;
            if (geom.x && geom.y) {
              issueLng = geom.x;
              issueLat = geom.y;
            }
          } catch (e) {
            console.error('Failed to parse issue.location WKB:', e)
          }
        }
      } else if (issue.location?.type === 'Point' && Array.isArray(issue.location.coordinates)) {
        issueLng = issue.location.coordinates[0]
        issueLat = issue.location.coordinates[1]
      } else {
        // Just return true for now if we can't parse it so we don't drop issues silently during testing
        return true
      }

      if (issueLat && issueLng) {
        const distance = getDistance(lat, lng, issueLat, issueLng)
        return distance <= 1000 // 1000 meters
      }
      return false
    })

    return NextResponse.json({ issues: nearbyIssues })
  } catch (error: any) {
    console.error('Error fetching reviews:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
