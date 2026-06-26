import { createServiceClient } from '@/lib/db/server'

async function check() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('issues')
    .select('id, location, status')
    .limit(5)
  console.log(JSON.stringify({ data, error }, null, 2))
}
check()
