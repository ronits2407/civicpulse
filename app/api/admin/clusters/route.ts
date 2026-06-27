import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/db/server'
import { kmeans } from 'ml-kmeans'
import wkx from 'wkx'

// Calculate WCSS (Within-Cluster Sum of Squares) manually as ml-kmeans doesn't expose it directly in a simple way
function calculateWCSS(data: number[][], clusters: number[], centroids: number[][]) {
  let wcss = 0
  for (let i = 0; i < data.length; i++) {
    const point = data[i]
    const clusterIdx = clusters[i]
    const centroid = centroids[clusterIdx]
    if (centroid) {
      // Euclidean distance squared
      const distSq = Math.pow(point[0] - centroid[0], 2) + Math.pow(point[1] - centroid[1], 2)
      wcss += distSq
    }
  }
  return wcss
}

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
    
    let optimalK = 1
    const maxK = Math.min(10, data.length)
    
    if (data.length > 2) {
      const wcssValues: number[] = []
      
      for (let k = 1; k <= maxK; k++) {
        const result = kmeans(data, k, { initialization: 'kmeans++' })
        const wcss = calculateWCSS(data, result.clusters, result.centroids.map(c => c))
        wcssValues.push(wcss)
      }
      
      // Improved Elbow Method: Kneedle algorithm (distance to line connecting first and last points)
      let maxDistance = -1
      const p1 = { x: 1, y: wcssValues[0] }
      const p2 = { x: maxK, y: wcssValues[maxK - 1] }
      
      const m = (p2.y - p1.y) / (p2.x - p1.x)
      const c = p1.y - m * p1.x

      for (let i = 0; i < wcssValues.length; i++) {
        const k = i + 1
        const wcss = wcssValues[i]
        
        // Line equation: y = m*x + c
        const lineY = m * k + c
        
        // Vertical distance from curve to the line
        // The curve is typically below the line, so lineY - wcss is positive
        const distance = lineY - wcss
        
        if (distance > maxDistance) {
          maxDistance = distance
          optimalK = k
        }
      }
      
      // Fallback if elbow not clearly found
      if (optimalK === 1 && data.length > 1) {
         optimalK = Math.max(1, Math.ceil(data.length / 10))
      }
    } else {
      optimalK = data.length
    }

    // Run final K-Means with optimal K
    const finalResult = kmeans(data, optimalK, { initialization: 'kmeans++' })
    
    // Group issues by cluster
    const clusteredIssues = finalResult.clusters.map((clusterIdx, i) => ({
      ...mappedIssues[i],
      route_cluster_id: `cluster_${clusterIdx}`
    }))
    
    const clusters = finalResult.centroids.map((centroid, idx) => ({
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
