import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const { data: issues } = await supabase
    .from('issues')
    .select('id, title, status')
    .ilike('title', '%traffic%')
    .eq('status', 'community_review')
    
  console.log('Issues:', issues)
  
  if (issues && issues.length > 0) {
    const issueId = issues[0].id
    console.log('Voting on issue:', issueId)
    
    // Fetch 3 users
    const { data: users } = await supabase.from('profiles').select('id').limit(3)
    const dummyUsers = users?.map(u => u.id) || []
    
    for (const userId of dummyUsers) {
      const res = await fetch(`http://localhost:3000/api/reviews/${issueId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, verdict: true, distanceMeters: 0 })
      })
      const json = await res.json()
      console.log(`Vote from ${userId} result:`, json)
    }
  }
}

main()
