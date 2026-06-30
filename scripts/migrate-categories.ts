import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkAndMigrate() {
  console.log("Fetching issues with category 'utility'...")
  const { data, error } = await supabase
    .from('issues')
    .select('id, category')
    .eq('category', 'utility')

  if (error) {
    console.error("Error fetching:", error)
    return
  }

  console.log(`Found ${data.length} issues with category 'utility'.`)

  if (data.length > 0) {
    console.log("Attempting to update to 'utilities'...")
    const { error: updateError } = await supabase
      .from('issues')
      .update({ category: 'utilities' })
      .eq('category', 'utility')

    if (updateError) {
      console.error("Update failed! There might be an enum or check constraint.", updateError)
    } else {
      console.log("Successfully updated all 'utility' rows to 'utilities'!")
    }
  } else {
    // If none found, just try to update a dummy one to see if it throws enum error
    console.log("No existing rows. Attempting a dummy insert to check constraints...")
    const { error: dummyError } = await supabase
      .from('issues')
      .insert({
        title: 'Dummy',
        description: 'Dummy',
        category: 'utilities',
        severity: 1,
        is_emergency: false,
        status: 'open',
        address: 'Dummy',
        location: `POINT(0 0)` // PostGIS might fail here if not raw sql, but let's see if we get enum error first
      })
    
    if (dummyError) {
      console.error("Dummy insert error:", dummyError)
    } else {
      console.log("Dummy insert succeeded!")
    }
  }
}

checkAndMigrate()
