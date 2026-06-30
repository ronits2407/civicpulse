import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { randomUUID } from 'crypto'
import path from 'path'
import { IssueCategory, IssueStatus } from '../lib/db/types'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const uuid = () => randomUUID()
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
const jitter = (val: number, spread: number) => val + (Math.random() - 0.5) * 2 * spread
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString()
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

const CATEGORIES: IssueCategory[] = ['infrastructure', 'sanitation', 'safety', 'utilities', 'environment', 'miscellaneous']
const STATUSES: IssueStatus[] = ['open', 'in_progress', 'resolved', 'closed', 'community_review']

// Scattered locations across India
const INDIA_CITIES = [
  { city: 'Mumbai', lat: 19.0760, lng: 72.8777 },
  { city: 'Delhi', lat: 28.6139, lng: 77.2090 },
  { city: 'Bengaluru', lat: 12.9716, lng: 77.5946 },
  { city: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
  { city: 'Chennai', lat: 13.0827, lng: 80.2707 },
  { city: 'Kolkata', lat: 22.5726, lng: 88.3639 },
  { city: 'Pune', lat: 18.5204, lng: 73.8567 },
  { city: 'Ahmedabad', lat: 23.0225, lng: 72.5714 },
  { city: 'Jaipur', lat: 26.9124, lng: 75.7873 },
  { city: 'Lucknow', lat: 26.8467, lng: 80.9462 },
  { city: 'Nagpur', lat: 21.1458, lng: 79.0882 },
  { city: 'Indore', lat: 22.7196, lng: 75.8577 },
  { city: 'Bhopal', lat: 23.2599, lng: 77.4126 },
  { city: 'Patna', lat: 25.5941, lng: 85.1376 },
  { city: 'Nashik', lat: 19.9975, lng: 73.7898 },
]

async function main() {
  const targetEmail = 'ronitsonawane2007@gmail.com'
  console.log(`Looking up user by email: ${targetEmail}`)
  
  const { data: profiles, error: profileErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', targetEmail)
    .limit(1)
  
  let userId = profiles?.[0]?.id

  if (!userId) {
    const { data: authUsers } = await supabase.auth.admin.listUsers()
    const user = authUsers?.users?.find(u => u.email === targetEmail)
    if (user) {
      userId = user.id
      console.log('User found in auth.users, but not in profiles. Using auth ID.')
    } else {
      console.error(`User with email ${targetEmail} not found! Please login once to create the account.`)
      process.exit(1)
    }
  }
  
  console.log(`Found user ID: ${userId}`)
  
  const allIssues = []
  const clusterInserts = []
  
  // 1. Completely scattered issues (20 issues)
  for (let i = 0; i < 20; i++) {
    const city = pick(INDIA_CITIES)
    const cat = pick(CATEGORIES)
    const status = pick(STATUSES)
    const lat = jitter(city.lat, 0.05)
    const lng = jitter(city.lng, 0.05)
    
    allIssues.push({
      id: uuid(),
      user_id: userId,
      title: `Standalone ${cat} issue in ${city.city}`,
      description: `Auto-generated scattered issue for testing map render.`,
      category: cat,
      subcategory: `general_${cat}`,
      severity: randInt(2, 9),
      is_emergency: Math.random() > 0.8,
      status: status,
      pipeline_stage: 'completed',
      location: `POINT(${lng} ${lat})`,
      address: `Near ${city.city} center`,
      created_at: daysAgo(randInt(1, 30))
    })
  }

  // 2. Close to each other but DIFFERENT categories (DBSCAN test) - 15 issues (3 cities x 5 issues)
  const dbscanCities = [
    INDIA_CITIES.find(c => c.city === 'Pune')!,
    INDIA_CITIES.find(c => c.city === 'Nagpur')!,
    INDIA_CITIES.find(c => c.city === 'Chennai')!
  ]
  
  for (const city of dbscanCities) {
    const centerLat = jitter(city.lat, 0.02)
    const centerLng = jitter(city.lng, 0.02)
    
    // Pick 5 distinct categories
    const shuffledCats = [...CATEGORIES].sort(() => Math.random() - 0.5).slice(0, 5)
    
    for (const cat of shuffledCats) {
      // Very close: spread 0.001 (approx 100m)
      const lat = jitter(centerLat, 0.001)
      const lng = jitter(centerLng, 0.001)
      
      allIssues.push({
        id: uuid(),
        user_id: userId,
        title: `DBSCAN Test - ${cat} near ${city.city}`,
        description: `Very close to other issues but different category. Should not be clustered by deduplication agent, but good for density analysis.`,
        category: cat,
        subcategory: `dbscan_${cat}`,
        severity: randInt(2, 9),
        is_emergency: false,
        status: pick(STATUSES),
        pipeline_stage: 'completed',
        location: `POINT(${lng} ${lat})`,
        address: `DBSCAN zone in ${city.city}`,
        created_at: daysAgo(randInt(1, 30))
      })
    }
  }

  // 3. True Clusters (Deduplication) - 3 clusters of 4-5 issues each (same category, tightly packed)
  const dedupCities = [
    INDIA_CITIES.find(c => c.city === 'Mumbai')!,
    INDIA_CITIES.find(c => c.city === 'Delhi')!,
    INDIA_CITIES.find(c => c.city === 'Bengaluru')!
  ]
  
  for (const city of dedupCities) {
    const clusterId = uuid()
    const issueCount = randInt(4, 5)
    // For clusters, use typical deduplication categories
    const cat = pick(['infrastructure', 'sanitation', 'environment'] as IssueCategory[])
    const centerLat = jitter(city.lat, 0.01)
    const centerLng = jitter(city.lng, 0.01)
    
    let representativeId: string | null = null
    
    for (let k = 0; k < issueCount; k++) {
      const issueId = uuid()
      if (k === 0) representativeId = issueId
      
      // extremely tight spread for deduplication (0.0005 ~ 50m)
      const lat = jitter(centerLat, 0.0005)
      const lng = jitter(centerLng, 0.0005)
      
      allIssues.push({
        id: issueId,
        user_id: userId,
        title: `Clustered ${cat} in ${city.city} #${k+1}`,
        description: `This issue is part of a deduplication cluster of type ${cat}.`,
        category: cat,
        subcategory: `cluster_${cat}`,
        severity: randInt(5, 9),
        is_emergency: false,
        status: pick(STATUSES),
        pipeline_stage: 'completed',
        location: `POINT(${lng} ${lat})`,
        address: `Dedup zone in ${city.city}`,
        cluster_id: clusterId,
        created_at: daysAgo(randInt(1, 10))
      })
    }
    
    clusterInserts.push({
      id: clusterId,
      representative_issue_id: representativeId!,
      issue_count: issueCount,
      category: cat,
      created_at: daysAgo(randInt(1, 10))
    })
  }

  console.log(`Generated ${allIssues.length} issues in total.`)
  
  // Insert Clusters first due to FK constraints
  if (clusterInserts.length > 0) {
    console.log(`Inserting ${clusterInserts.length} issue clusters...`)
    const { error: clusterErr } = await supabase.from('issue_clusters').insert(clusterInserts)
    if (clusterErr) {
      console.error('Error inserting clusters:', clusterErr)
      process.exit(1)
    }
  }
  
  // Insert Issues
  console.log(`Inserting ${allIssues.length} issues into DB...`)
  const { error: issueErr } = await supabase.from('issues').insert(allIssues)
  
  if (issueErr) {
    console.error('Error inserting issues:', issueErr)
    process.exit(1)
  }
  
  console.log('Successfully seeded database for user ronitsonawane2007@gmail.com!')
}

main().catch(console.error)
