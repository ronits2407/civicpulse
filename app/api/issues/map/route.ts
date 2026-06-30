import { createServiceClient } from '@/lib/db/server'
import { NextResponse } from 'next/server'
import wkx from 'wkx'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('issues')
      .select('id, title, category, status, address, location, cluster_id, severity, created_at')
      .or('status.neq.closed,cluster_id.not.is.null')
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Decode PostGIS WKB location strings into {lat, lng} objects
    const mappedIssues = (data || []).map((issue: any) => {
      let loc = issue.location
      if (typeof loc === 'string') {
        try {
          const geom = wkx.Geometry.parse(Buffer.from(loc, 'hex'))
          const geojson = geom.toGeoJSON() as any
          if (geojson.type === 'Point') {
            loc = { lat: geojson.coordinates[1], lng: geojson.coordinates[0] }
          }
        } catch (e) {
          loc = null
        }
      }
      return { ...issue, location: loc }
    })

    // Filter to only issues that have valid location data
    const validIssues = mappedIssues.filter(
      (issue) =>
        issue.location &&
        typeof issue.location.lat === 'number' &&
        typeof issue.location.lng === 'number'
    )

    return NextResponse.json({ issues: validIssues })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
