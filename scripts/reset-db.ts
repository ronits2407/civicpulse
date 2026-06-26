import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function resetDatabase() {
  console.log("⚠️ WARNING: INITIATING FULL DATABASE WIPE ⚠️\n")

  // 1. Delete all transactional tables in correct foreign-key order
  const tablesToClear = [
    'verifications',
    'upvotes',
    'karma_events',
    'predictive_alerts',
    'issues',
    'issue_clusters'
    // 'departments' - We typically keep departments as they are seed data.
  ]

  for (const table of tablesToClear) {
    console.log(`Clearing table: ${table}...`)
    // Delete all rows where id is not null
    const { error } = await supabase
      .from(table)
      .delete()
      .not('id', 'is', null)

    if (error) {
      console.error(`❌ Failed to clear ${table}:`, error.message)
    } else {
      console.log(`✅ Cleared ${table}`)
    }
  }

  // 2. Clear Auth Users (this usually cascades to `profiles`)
  console.log(`\nClearing all authentication users...`)
  const { data: users, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) {
    console.error(`❌ Failed to list users:`, listError.message)
  } else if (users && users.users) {
    for (const user of users.users) {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id)
      if (deleteError) {
        console.error(`❌ Failed to delete user ${user.email}:`, deleteError.message)
      }
    }
    console.log(`✅ Deleted ${users.users.length} users.`)
  }

  // 3. Clear the issue-media storage bucket
  console.log(`\nClearing 'issue-media' storage bucket...`)
  const { data: files, error: filesError } = await supabase.storage.from('issue-media').list()
  
  if (filesError) {
    console.error(`❌ Failed to list files in issue-media:`, filesError.message)
  } else if (files && files.length > 0) {
    const fileNames = files.map(f => f.name)
    const { error: removeError } = await supabase.storage.from('issue-media').remove(fileNames)
    if (removeError) {
      console.error(`❌ Failed to delete files:`, removeError.message)
    } else {
      console.log(`✅ Deleted ${files.length} files from 'issue-media'.`)
    }
  } else {
    console.log(`✅ 'issue-media' bucket is already empty.`)
  }

  console.log("\n🎉 Database reset complete! It is now brand new.")
}

resetDatabase().catch(console.error)
