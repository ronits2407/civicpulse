/**
 * Geographic DBSCAN-style clustering for the Route Planner
 * =========================================================
 * Replaces K-Means (which used Euclidean lat/lng distance and a fixed
 * cluster cap) with a proper geographic algorithm that:
 *
 *  • Uses **Haversine distance** (metres) — no flat-earth distortion
 *  • Constrains each cluster to MAX_RADIUS_M (≈ one district / city zone)
 *  • Derives the number of clusters from the data — no fixed k limit
 *  • Is deterministic and fast (O(n²) worst case, fine for ≤5000 issues)
 *
 * Exported API is **backwards-compatible** with the old K-Means API so
 * the route handler and RoutePlannerPanel need no changes.
 */

// ── Tuneable constants ────────────────────────────────────────────────────────
/** Hard cap on how far any issue can be from its cluster centroid (metres).
 *  50 km ≈ typical Indian district / city metropolitan boundary. */
const MAX_RADIUS_M = 50_000

/** Search window — how close an issue's nearest centroid must be before we
 *  even consider adding it to that cluster. Should be ≤ MAX_RADIUS_M. */
const EPSILON_M = 40_000

/** Minimum issues in a group before it's a "cluster" (for the route planner
 *  a single issue can still be its own cluster so we keep this at 1). */
const MIN_CLUSTER_SIZE = 1

// ── Haversine distance ────────────────────────────────────────────────────────
function haversineMetres(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6_371_000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Centroid helper ───────────────────────────────────────────────────────────
function meanOf(points: number[][]): number[] {
  const n = points.length
  return [
    points.reduce((s, p) => s + p[0], 0) / n,
    points.reduce((s, p) => s + p[1], 0) / n,
  ]
}

// ── Public types (unchanged from old API) ─────────────────────────────────────
export interface ClusteringResult {
  /** Per-point cluster index (0-based, same length as input data) */
  clusters: number[]
  /** Centroid [lat, lng] for each cluster */
  centroids: number[][]
  /** Number of clusters found */
  optimalK: number
}

/**
 * Geographic clustering with automatic cluster count.
 *
 * @param data      Array of [lat, lng] coordinates (one per issue)
 * @param _maxKLimit Ignored — kept for backwards-compat with old signature
 */
export function getOptimalClusters(
  data: number[][],
  _maxKLimit: number = 10   // parameter retained for API compatibility
): ClusteringResult {
  if (data.length === 0) return { clusters: [], centroids: [], optimalK: 0 }
  if (data.length === 1) return { clusters: [0], centroids: [data[0]], optimalK: 1 }

  // ── Greedy geographic clustering ──────────────────────────────────────────
  // Each group tracks its member indices and a running centroid.
  const groups: { members: number[]; centroid: number[] }[] = []

  for (let i = 0; i < data.length; i++) {
    const [lat, lng] = data[i]

    let bestGroup = -1
    let bestDist = Infinity

    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi]
      const [cLat, cLng] = g.centroid
      const dist = haversineMetres(lat, lng, cLat, cLng)

      if (dist > EPSILON_M) continue

      // Simulate new centroid and check the max-radius constraint
      const members = g.members
      const n = members.length
      const newCLat = (cLat * n + lat) / (n + 1)
      const newCLng = (cLng * n + lng) / (n + 1)

      // Farthest existing member from the new centroid
      const worstExisting = Math.max(
        ...members.map((mi) =>
          haversineMetres(data[mi][0], data[mi][1], newCLat, newCLng)
        )
      )
      const newPointDist = haversineMetres(lat, lng, newCLat, newCLng)
      const maxDist = Math.max(worstExisting, newPointDist)

      if (maxDist > MAX_RADIUS_M) continue // would violate district boundary

      if (dist < bestDist) {
        bestDist = dist
        bestGroup = gi
      }
    }

    if (bestGroup >= 0) {
      const g = groups[bestGroup]
      g.members.push(i)
      g.centroid = meanOf(g.members.map((mi) => data[mi]))
    } else {
      groups.push({ members: [i], centroid: [lat, lng] })
    }
  }

  // ── Build output arrays ───────────────────────────────────────────────────
  // Filter out sub-minimum groups and reassign to nearest valid cluster
  const validGroups = groups.filter((g) => g.members.length >= MIN_CLUSTER_SIZE)

  // If somehow everything was filtered (shouldn't happen with MIN=1), put each
  // point in its own cluster.
  if (validGroups.length === 0) {
    return {
      clusters: data.map((_, i) => i),
      centroids: data.map((p) => p),
      optimalK: data.length,
    }
  }

  const clusterAssignment = new Array<number>(data.length).fill(-1)

  for (let gi = 0; gi < validGroups.length; gi++) {
    for (const mi of validGroups[gi].members) {
      clusterAssignment[mi] = gi
    }
  }

  // Any unassigned points (filtered-out groups) → assign to nearest valid centroid
  for (let i = 0; i < data.length; i++) {
    if (clusterAssignment[i] !== -1) continue
    const [lat, lng] = data[i]
    let nearest = 0
    let nearestDist = Infinity
    for (let gi = 0; gi < validGroups.length; gi++) {
      const [cLat, cLng] = validGroups[gi].centroid
      const d = haversineMetres(lat, lng, cLat, cLng)
      if (d < nearestDist) { nearestDist = d; nearest = gi }
    }
    clusterAssignment[i] = nearest
  }

  const centroids = validGroups.map((g) => g.centroid)
  const optimalK = validGroups.length

  return { clusters: clusterAssignment, centroids, optimalK }
}

// ── Legacy export (kept for any future import that used calculateWCSS) ────────
export function calculateWCSS(
  _data: number[][], _clusters: number[], _centroids: number[][]
): number {
  return 0 // no longer meaningful without K-Means; retained for API compat
}
