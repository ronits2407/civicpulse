import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/db/server'
import { getOptimalClusters } from '@/lib/utils/clustering'
import wkx from 'wkx'
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch active issues
    const { data: issues, error } = await supabase
      .from('issues')
      .select('*')
      .in('status', ['open', 'in_progress'])
      
    if (error) throw error

    // Decode PostGIS WKB location strings into {lat, lng} objects
    const mappedIssues = issues.map((issue: any) => {
      let loc = issue.location
      if (typeof loc === 'string') {
        try {
          // Sometimes it might start with POINT or it might be hex.
          if (loc.startsWith('POINT')) {
            const match = loc.match(/POINT\(([^ ]+) ([^)]+)\)/)
            if (match) {
              loc = { lat: parseFloat(match[2]), lng: parseFloat(match[1]) }
            }
          } else {
            const geom = wkx.Geometry.parse(Buffer.from(loc, 'hex'))
            const geojson = geom.toGeoJSON() as any
            if (geojson.type === 'Point') {
              loc = { lat: geojson.coordinates[1], lng: geojson.coordinates[0] }
            }
          }
        } catch (e) {
          loc = null
        }
      }
      return { ...issue, location: loc }
    }).filter(i => i.location && typeof i.location.lat === 'number' && typeof i.location.lng === 'number')

    if (mappedIssues.length === 0) {
      return NextResponse.json({ clusters: [] })
    }

    // Extract coordinates
    const data = mappedIssues.map(i => [i.location.lat, i.location.lng])
    
    const { clusters: finalClusters, centroids, optimalK } = getOptimalClusters(data)
    
    // Group issues by cluster
    const clusteredIssues = finalClusters.map((clusterIdx, i) => ({
      ...mappedIssues[i],
      route_cluster_id: `cluster_${clusterIdx}`
    }))
    
    const clusters = centroids.map((centroid, idx) => ({
      id: `cluster_${idx}`,
      centroid: { lat: centroid[0], lng: centroid[1] },
      issues: clusteredIssues.filter(i => i.route_cluster_id === `cluster_${idx}`)
    }))

    return NextResponse.json({ clusters, optimalK })

  } catch (error: any) {
    console.error('Clustering error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
