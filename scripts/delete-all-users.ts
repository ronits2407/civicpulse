import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function deleteAllUsers() {
  const isConfirmed = process.argv.includes('--confirm')

  if (!isConfirmed) {
    console.warn(`
⚠️  WARNING: DESTRUCTIVE ACTION DETECTED ⚠️

This script will permanently delete ALL users from Supabase Auth.
Due to foreign key constraints, this will also delete all user-related data:
  - verifications
  - upvotes
  - karma_events
  - issues (and cascade to clusters/etc. if needed)
  - profiles (automatically via 'on delete cascade' foreign key)

If you are absolutely sure you want to proceed, run:
  bun scripts/delete-all-users.ts --confirm
`)
    process.exit(0)
  }

  console.log("🔄 Starting the user deletion process...")

  // 1. Fetch all users from Supabase Auth
  console.log("Fetching users from Supabase Auth...")
  const allUsers: any[] = []
  let page = 1
  const perPage = 1000
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage
    })

    if (error) {
      console.error("❌ Failed to list users:", error.message)
      process.exit(1)
    }

    const users = data?.users || []
    if (users.length === 0) {
      hasMore = false
    } else {
      allUsers.push(...users)
      page++
    }
  }

  if (allUsers.length === 0) {
    console.log("✅ No users found in Supabase Auth. Nothing to delete.")
    process.exit(0)
  }

  console.log(`Found ${allUsers.length} user(s) to delete.`)

  // 2. Clear transactional data referencing public.profiles (to satisfy foreign keys)
  console.log("\n🧹 Clearing dependent transactional tables to avoid foreign key violations...")
  
  const tablesToClear = ['verifications', 'upvotes', 'karma_events', 'issues']
  for (const table of tablesToClear) {
    console.log(`  Clearing table: ${table}...`)
    const { error } = await supabase
      .from(table)
      .delete()
      .not('id', 'is', null)

    if (error) {
      console.error(`  ❌ Failed to clear ${table}:`, error.message)
      console.warn("  (Proceeding anyway, but user deletion might fail if references remain.)")
    } else {
      console.log(`  ✅ Cleared ${table}`)
    }
  }

  // 3. Delete the users
  console.log(`\n🔥 Deleting ${allUsers.length} user(s) from Supabase Auth...`)
  let deletedCount = 0
  let failedCount = 0

  for (let i = 0; i < allUsers.length; i++) {
    const user = allUsers[i]
    const userIdentifier = user.email || user.phone || user.id
    console.log(`[${i + 1}/${allUsers.length}] Deleting user: ${userIdentifier} (${user.id})...`)

    const { error } = await supabase.auth.admin.deleteUser(user.id)

    if (error) {
      console.error(`  ❌ Failed to delete user ${userIdentifier}:`, error.message)
      failedCount++
    } else {
      deletedCount++
    }
  }

  console.log(`\n🎉 User deletion process finished!`)
  console.log(`   - Successfully deleted: ${deletedCount}`)
  console.log(`   - Failed to delete: ${failedCount}`)
}

deleteAllUsers().catch((error) => {
  console.error("❌ Unhandled exception:", error)
  process.exit(1)
})
