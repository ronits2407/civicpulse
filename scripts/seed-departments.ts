import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const departments = [
  {
    name: 'Public Works Department (PWD)',
    category_scope: ['infrastructure'],
    avg_resolution_hours: 72
  },
  {
    name: 'Solid Waste Management (SWM)',
    category_scope: ['sanitation'],
    avg_resolution_hours: 48
  },
  {
    name: 'Traffic Police & Safety',
    category_scope: ['safety'],
    avg_resolution_hours: 24
  },
  {
    name: 'Water & Electricity Board',
    category_scope: ['utility'],
    avg_resolution_hours: 48
  },
  {
    name: 'Environmental Protection & Parks',
    category_scope: ['environment'],
    avg_resolution_hours: 120
  }
]

async function seedDepartments() {
  console.log("Seeding departments...")

  // We can just wipe existing departments just in case
  const { error: clearError } = await supabase.from('departments').delete().not('id', 'is', null)
  if (clearError) {
    console.warn("Could not clear existing departments (might be tied to existing issues):", clearError.message)
  }

  const { data, error } = await supabase.from('departments').insert(departments).select()
  
  if (error) {
    console.error("❌ Failed to seed departments:", error.message)
  } else {
    console.log(`✅ Successfully seeded ${data.length} departments:`)
    data.forEach(d => console.log(`  - ${d.name} (${d.category_scope.join(', ')})`))
  }
}

seedDepartments().catch(console.error)
