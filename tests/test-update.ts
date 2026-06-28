import { createClient } from '@supabase/supabase-js'

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabase = createClient(supabaseUrl, supabaseKey)

  const issueId = '4f21926d-33dc-48da-8522-7a5bab2d61b9'

  // First check if it exists
  const { data: issue, error: fetchErr } = await supabase.from('issues').select('*').eq('id', issueId).single()
  console.log('Exists?', issue ? 'Yes' : 'No', fetchErr)

  // Try updating
  const { data: updated, error: updateErr } = await supabase.from('issues').update({ status: 'in_progress' }).eq('id', issueId).select().single()
  console.log('Updated?', updated ? 'Yes' : 'No', updateErr)
}

run()
