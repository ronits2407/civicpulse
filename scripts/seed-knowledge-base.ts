import { createClient } from '@supabase/supabase-js'
import { generateEmbedding } from '../lib/ai/client'
import fs from 'fs'
import path from 'path'

// Load environment variables directly if needed for standalone script
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function main() {
  console.log('Seeding Civic Knowledge Base for RAG...')
  
  // Clear existing embeddings first
  console.log('Clearing existing data from civic_knowledge_base...')
  const { error: deleteError } = await supabase.from('civic_knowledge_base').delete().neq('id', '00000000-0000-0000-0000-000000000000') // Deletes all rows safely
  if (deleteError) {
    console.error('Failed to clear table:', deleteError)
    return
  }
  
  const dataPath = path.join(process.cwd(), 'data', 'civic_sops.json')
  const rawData = fs.readFileSync(dataPath, 'utf-8')
  const sops = JSON.parse(rawData)

  for (const sop of sops) {
    console.log(`Processing SOP for category: ${sop.category}`)
    try {
      const embedding = await generateEmbedding(sop.content)
      
      const { error } = await supabase.from('civic_knowledge_base').insert({
        category: sop.category,
        content: sop.content,
        embedding: embedding
      })
      
      if (error) {
        console.error('Failed to insert:', error)
      } else {
        console.log('Successfully inserted SOP.')
      }
    } catch (e) {
      console.error('Error embedding/inserting SOP:', e)
    }
  }
  console.log('Knowledge Base seeding complete.')
}

main().catch(console.error)
