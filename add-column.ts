import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

// Use postgres directly to add the column
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// We'll use the Supabase REST API with a raw SQL query via the management API
// Actually, we need to do this via the database URL
const { default: pg } = await import('pg')
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL
})

await client.connect()
await client.query('ALTER TABLE issues ADD COLUMN IF NOT EXISTS image_analysis text;')
console.log('✅ Added image_analysis column')
await client.end()
