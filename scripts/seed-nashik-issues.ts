import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const CATEGORIES = ['infrastructure', 'sanitation', 'safety', 'utility', 'environment']
const STATUS = ['open', 'in_progress']

const CENTROIDS = [
  { lat: 19.9975, lng: 73.7898, name: 'Nashik Center (Panchavati)' },
  { lat: 19.9700, lng: 73.7500, name: 'Nashik South West (Pathardi Phata)' },
  { lat: 20.0200, lng: 73.8200, name: 'Nashik North East (Adgaon)' },
  { lat: 19.9500, lng: 73.8000, name: 'Nashik South (Nashik Road)' },
]

function getRandomOffset() {
  return (Math.random() - 0.5) * 0.01 // rough ~500m offset
}

async function seedIssues() {
  console.log('Seeding issues...')
  let totalSeeded = 0

  // First, get an admin user to act as the reporter, or any user
  const { data: users, error: usersErr } = await supabase.from('profiles').select('id').limit(1)
  const userId = users?.[0]?.id

  if (!userId) {
    console.error('No users found in database to attach issues to.')
    return
  }

  const issues = []

  for (const centroid of CENTROIDS) {
    // Generate 5 issues per centroid
    for (let i = 0; i < 5; i++) {
      const lat = centroid.lat + getRandomOffset()
      const lng = centroid.lng + getRandomOffset()
      const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)]
      const status = STATUS[Math.floor(Math.random() * STATUS.length)]

      issues.push({
        user_id: userId,
        title: `Synthetic ${category} issue in ${centroid.name} - ${i + 1}`,
        description: `This is an auto-generated issue for testing route planner in ${centroid.name}. Needs immediate attention.`,
        category: category,
        severity: Math.floor(Math.random() * 5) + 3, // 3 to 7
        status: status,
        location: `POINT(${lng} ${lat})`,
        address: `Near ${centroid.name}`,
        created_at: new Date().toISOString()
      })
    }
  }

  const { error } = await supabase.from('issues').insert(issues)

  if (error) {
    console.error('Error inserting issues:', error)
  } else {
    totalSeeded += issues.length
    console.log(`Successfully seeded ${totalSeeded} issues across ${CENTROIDS.length} clusters!`)
  }
}

seedIssues()
