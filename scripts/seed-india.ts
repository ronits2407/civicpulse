/**
 * CivicPulse — Full India Seed Script
 * =====================================
 * Creates a rich, consistent dataset that demos:
 *   • Multiple users (admins + citizens) with home locations
 *   • ~250 issues spread across 12 major Indian cities
 *   • Issue clusters (for KMeans / routing demo) with 4–9 issues per cluster
 *   • Full agentic trace on every issue (pipeline_stage = 'completed')
 *   • Agent 5 predictive_alerts pre-seeded with realistic outputs
 *   • Verifications, karma events
 *   • Departments seeded fresh before issues
 *
 * Run:  bun run scripts/seed-india.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { randomUUID } from 'crypto'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

const uuid = () => randomUUID()
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
const pickN = <T>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(n, arr.length))
}
const randInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min
const randFloat = (min: number, max: number) =>
  Math.random() * (max - min) + min
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString()
const jitter = (val: number, spread: number) =>
  val + (Math.random() - 0.5) * 2 * spread

// ─── City Hotspot Clusters ────────────────────────────────────────────────────
// Each cluster has a tight centroid + category — perfect for KMeans clustering demo

const CITY_CLUSTERS = [
  // Mumbai — 5 clusters
  { city: 'Mumbai', state: 'Maharashtra', lat: 19.0760, lng: 72.8777, spread: 0.01, category: 'infrastructure' as const, label: 'Dharavi Pothole Belt' },
  { city: 'Mumbai', state: 'Maharashtra', lat: 19.0330, lng: 72.8553, spread: 0.008, category: 'sanitation' as const, label: 'Kurla Garbage Crisis' },
  { city: 'Mumbai', state: 'Maharashtra', lat: 19.1136, lng: 72.8697, spread: 0.009, category: 'utility' as const, label: 'Andheri Power Outages' },
  { city: 'Mumbai', state: 'Maharashtra', lat: 18.9220, lng: 72.8347, spread: 0.007, category: 'environment' as const, label: 'Colaba Coastal Pollution' },
  { city: 'Mumbai', state: 'Maharashtra', lat: 19.0596, lng: 72.9051, spread: 0.01, category: 'safety' as const, label: 'Ghatkopar Signal Failures' },

  // Delhi — 5 clusters
  { city: 'New Delhi', state: 'Delhi', lat: 28.6139, lng: 77.2090, spread: 0.01, category: 'infrastructure' as const, label: 'Connaught Place Road Damage' },
  { city: 'New Delhi', state: 'Delhi', lat: 28.6517, lng: 77.2219, spread: 0.009, category: 'sanitation' as const, label: 'Chandni Chowk Waste Overflow' },
  { city: 'New Delhi', state: 'Delhi', lat: 28.5355, lng: 77.3910, spread: 0.012, category: 'environment' as const, label: 'Noida Border Air Quality' },
  { city: 'New Delhi', state: 'Delhi', lat: 28.7041, lng: 77.1025, spread: 0.01, category: 'utility' as const, label: 'Rohini Water Shortage' },
  { city: 'New Delhi', state: 'Delhi', lat: 28.6692, lng: 77.4538, spread: 0.008, category: 'safety' as const, label: 'Ghaziabad Accident Zone' },

  // Bengaluru — 4 clusters
  { city: 'Bengaluru', state: 'Karnataka', lat: 12.9716, lng: 77.5946, spread: 0.009, category: 'infrastructure' as const, label: 'MG Road Crater Zone' },
  { city: 'Bengaluru', state: 'Karnataka', lat: 13.0358, lng: 77.5970, spread: 0.01, category: 'sanitation' as const, label: 'Hebbal Lake Garbage' },
  { city: 'Bengaluru', state: 'Karnataka', lat: 12.9279, lng: 77.6271, spread: 0.008, category: 'utility' as const, label: 'Koramangala Power Cuts' },
  { city: 'Bengaluru', state: 'Karnataka', lat: 12.9007, lng: 77.5991, spread: 0.009, category: 'environment' as const, label: 'Bellandur Lake Froth' },

  // Hyderabad — 3 clusters
  { city: 'Hyderabad', state: 'Telangana', lat: 17.3850, lng: 78.4867, spread: 0.01, category: 'infrastructure' as const, label: 'HITEC City Road Damage' },
  { city: 'Hyderabad', state: 'Telangana', lat: 17.4435, lng: 78.3772, spread: 0.009, category: 'sanitation' as const, label: 'Old City Drain Overflow' },
  { city: 'Hyderabad', state: 'Telangana', lat: 17.3616, lng: 78.4747, spread: 0.008, category: 'safety' as const, label: 'Jubilee Hills Streetlight Gap' },

  // Chennai — 3 clusters
  { city: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lng: 80.2707, spread: 0.009, category: 'infrastructure' as const, label: 'T. Nagar Pothole Cluster' },
  { city: 'Chennai', state: 'Tamil Nadu', lat: 13.0569, lng: 80.2425, spread: 0.01, category: 'sanitation' as const, label: 'Adyar River Trash' },
  { city: 'Chennai', state: 'Tamil Nadu', lat: 13.1143, lng: 80.2329, spread: 0.008, category: 'environment' as const, label: 'Perambur Industrial Pollution' },

  // Kolkata — 3 clusters
  { city: 'Kolkata', state: 'West Bengal', lat: 22.5726, lng: 88.3639, spread: 0.009, category: 'infrastructure' as const, label: 'Park Street Road Damage' },
  { city: 'Kolkata', state: 'West Bengal', lat: 22.5958, lng: 88.3697, spread: 0.01, category: 'sanitation' as const, label: 'Shyambazar Garbage Crisis' },
  { city: 'Kolkata', state: 'West Bengal', lat: 22.5547, lng: 88.3490, spread: 0.008, category: 'utility' as const, label: 'Jadavpur Power Outage' },

  // Ahmedabad — 2 clusters
  { city: 'Ahmedabad', state: 'Gujarat', lat: 23.0225, lng: 72.5714, spread: 0.01, category: 'infrastructure' as const, label: 'CG Road Potholes' },
  { city: 'Ahmedabad', state: 'Gujarat', lat: 23.0395, lng: 72.5496, spread: 0.009, category: 'sanitation' as const, label: 'Maninagar Waste Issue' },

  // Pune — 2 clusters
  { city: 'Pune', state: 'Maharashtra', lat: 18.5204, lng: 73.8567, spread: 0.009, category: 'infrastructure' as const, label: 'FC Road Bridge Damage' },
  { city: 'Pune', state: 'Maharashtra', lat: 18.5089, lng: 73.8259, spread: 0.01, category: 'environment' as const, label: 'Mula River Dumping' },

  // Nashik — 2 clusters
  { city: 'Nashik', state: 'Maharashtra', lat: 19.9975, lng: 73.7898, spread: 0.008, category: 'infrastructure' as const, label: 'College Road Potholes' },
  { city: 'Nashik', state: 'Maharashtra', lat: 19.9969, lng: 73.8073, spread: 0.007, category: 'sanitation' as const, label: 'Panchavati Waste' },

  // Lucknow — 2 clusters
  { city: 'Lucknow', state: 'Uttar Pradesh', lat: 26.8467, lng: 80.9462, spread: 0.01, category: 'infrastructure' as const, label: 'Hazratganj Road Damage' },
  { city: 'Lucknow', state: 'Uttar Pradesh', lat: 26.8733, lng: 80.9198, spread: 0.009, category: 'safety' as const, label: 'Gomti Nagar Accident Zone' },

  // Kochi — 1 cluster
  { city: 'Kochi', state: 'Kerala', lat: 9.9312, lng: 76.2673, spread: 0.01, category: 'environment' as const, label: 'Backwaters Pollution' },

  // Jaipur — 1 cluster
  { city: 'Jaipur', state: 'Rajasthan', lat: 26.9124, lng: 75.7873, spread: 0.01, category: 'sanitation' as const, label: 'Walled City Garbage' },
]

// ─── Data Templates ───────────────────────────────────────────────────────────

const SUBCATS: Record<string, string[]> = {
  infrastructure: ['pothole', 'broken_road', 'damaged_footpath', 'bridge_damage', 'traffic_signal_fault', 'road_cave_in', 'drainage_blockage'],
  sanitation: ['garbage_overflow', 'illegal_dumping', 'open_defecation', 'stagnant_water', 'sewage_leak', 'dead_animal_disposal', 'overflowing_drain'],
  safety: ['broken_streetlight', 'missing_manhole_cover', 'dangerous_structure', 'fire_hazard', 'crime_hotspot', 'traffic_accident_zone'],
  utility: ['water_leakage', 'power_outage', 'no_water_supply', 'gas_leak', 'transformer_fault', 'broken_pipeline'],
  environment: ['air_pollution', 'water_pollution', 'noise_pollution', 'tree_fallen', 'lake_contamination', 'industrial_discharge', 'plastic_burning'],
}

const ISSUE_TITLES: Record<string, string[]> = {
  infrastructure: [
    'Deep pothole causing vehicle damage on main road',
    'Large crater near school entrance creating hazard',
    'Road completely broken after monsoon season',
    'Footpath tiles broken and dangerous for pedestrians',
    'Traffic signal malfunctioning at busy intersection',
    'Bridge railing broken posing serious risk',
    'Road cave-in blocking traffic near market area',
    'Drainage pipe collapsed under main road',
  ],
  sanitation: [
    'Garbage not collected for 5 days, flies swarming',
    'Illegal dumping site near residential colony',
    'Open sewage flowing onto public road',
    'Stagnant water breeding mosquitoes near park',
    'Sewage manhole overflowing onto footpath',
    'Dead animal carcass left on public road',
    'Overflowing drain causing health risk',
    'Trash bins overflowing, no civic response',
  ],
  safety: [
    'Streetlight broken for 3 weeks, very dark at night',
    'Manhole cover missing, serious accident risk',
    'Old building structure collapsing on public road',
    'Exposed electrical wires near bus stop',
    'Multiple accidents at this intersection this month',
    'No speed breaker near school, children at risk',
    'Broken barricade on highway causing danger',
  ],
  utility: [
    'No water supply for 48 hours in entire locality',
    'Water pipeline leaking since last week',
    'Power outage lasting more than 8 hours',
    'Transformer fault left colony without electricity',
    'Suspected gas leak in residential area',
    'Water pressure very low for past week',
  ],
  environment: [
    'Factory releasing black smoke causing breathing issues',
    'Lake contaminated with industrial waste',
    'Plastic burning near school, smoke is unbearable',
    'Fallen tree blocking main road after storm',
    'River dumping by construction company',
    'Loud noise from illegal crusher plant at night',
    'Chemical smell from nearby factory',
  ],
}

const DESCRIPTIONS: Record<string, string[]> = {
  infrastructure: [
    'The pothole is approximately 2 feet wide and very deep. Multiple two-wheelers have fallen. I have complained twice before but no action taken.',
    'After the recent rains, the road has completely broken near the market area. Vehicles are taking detours. The road quality was poor to begin with.',
    'The footpath tiles are cracked and sticking out. An elderly person fell and got injured last week. Contractors laid poor quality tiles.',
    'The traffic signal has been showing red for all directions since yesterday. Cars are honking and creating chaos. No traffic police on duty.',
  ],
  sanitation: [
    'Garbage truck has not come to our ward for 6 days. The bins are overflowing and garbage is spilling onto the road. Stray dogs are scattering the waste.',
    'There is an illegal dumping site near our colony boundary. People from outside are dumping construction debris and household waste there.',
    'The sewer line has burst and raw sewage is flowing onto the main road. Children cannot go to school. This is a serious health emergency.',
    'Mosquito breeding has increased massively due to stagnant water in the broken road near the park. Dengue cases reported in our area.',
  ],
  safety: [
    'The streetlight pole has been dark for more than 2 weeks. The area is very dark at night and I feel unsafe walking home.',
    'A manhole cover is missing since last night. Very dangerous especially for bikes at night. Please send someone urgently.',
    'The old building on the corner is showing signs of collapse. Bricks are falling onto the footpath.',
    'Electric wires are hanging very low near the bus stop. After the recent wind storm, they are touching each other and sparking.',
  ],
  utility: [
    'There is absolutely no water supply since yesterday morning. We have been buying water from tankers at very high cost.',
    'The water main pipe is leaking at the junction. A lot of water is being wasted and the road is becoming slippery.',
    'The entire colony has no electricity since this morning. The local electricity office is not picking up their phone.',
    'We can smell gas strongly near the end of our street. Some residents have turned off their stoves. Please send emergency team immediately.',
  ],
  environment: [
    'The factory next to our colony is releasing thick black smoke from the morning. Many residents have breathing issues. Children are falling sick.',
    'The lake near our area which used to be clean has turned black. A chemical company has been dumping waste here.',
    'Someone is burning plastic waste near our locality every evening. The smoke is unbearable and children are affected.',
    'A large tree fell on the main road blocking traffic completely. No one from the municipal corporation has come to clear it.',
  ],
}

const CIVIC_BRIEFS: Record<string, string[]> = {
  infrastructure: [
    'CIVIC ACTION BRIEF: A critical road infrastructure failure has been reported at the specified location. The pothole, measuring approximately 2 feet in diameter and significant depth, poses an immediate risk to vehicular traffic.\\n\\nThe Public Works Department is directed to dispatch an emergency repair team within the mandated SLA window. Priority should be given to temporary patching followed by permanent road resurfacing.\\n\\nHistorical data for this stretch shows recurring complaints, indicating systemic poor road quality. A comprehensive road audit is recommended post-repair.',
    'CIVIC ACTION BRIEF: Severe road damage following monsoon activity has rendered the carriageway hazardous at the reported location.\\n\\nThe PWD team must mobilize within 24 hours: (1) Deploy temporary barricading to divert traffic, (2) Emergency pothole filling with hot-mix asphalt, (3) Full road survey of the 500m stretch.\\n\\nEngineering cell to conduct root-cause analysis on waterlogging-induced road damage in this corridor.',
  ],
  sanitation: [
    'CIVIC ACTION BRIEF: A critical sanitation failure has been reported. Municipal garbage collection has been suspended for over 5 days, creating an acute health hazard.\\n\\nSolid Waste Management must: (1) Deploy emergency collection vehicle within 12 hours, (2) Conduct deep cleaning and sanitization, (3) Investigate root cause of collection lapse.\\n\\nHealth department to assess mosquito and rodent risk. Contractor penalties to be levied as per SLA agreement.',
    'CIVIC ACTION BRIEF: An unauthorized waste dumping site has been established near the residential area, creating sustained nuisance.\\n\\nSWM must: (1) Dispatch a team within 48 hours to clear the illegal dump, (2) Coordinate with police for CCTV installation, (3) Erect No Dumping signage post-clearance.\\n\\nLegal notice to be served to identified offenders.',
  ],
  safety: [
    'CIVIC ACTION BRIEF: A critical safety hazard involving non-functional street lighting has been reported. The affected stretch has been in darkness contributing to criminal incidents in the area.\\n\\nElectricity Department must: (1) Inspect and replace faulty fixture within 6 hours, (2) Conduct audit of all 50m surrounding street lights, (3) Upgrade to LED fixtures if infrastructure is end-of-life.\\n\\nTraffic Police to increase patrolling frequency until lights are restored.',
    'CIVIC ACTION BRIEF: A missing manhole cover has been reported creating an immediate life-threatening hazard for road users.\\n\\nEmergency response required: (1) Immediate temporary barricading around open manhole, (2) Replacement cover to be installed within 6 hours, (3) Audit of surrounding manholes for similar defects.\\n\\nResponsible contractor to be held accountable.',
  ],
  utility: [
    'CIVIC ACTION BRIEF: Complete cessation of water supply has been reported for the specified locality, constituting an emergency civic failure.\\n\\nWater & Electricity Board must: (1) Identify root cause within 2 hours, (2) Deploy tanker supply as immediate relief, (3) Restore pipeline supply within 24 hours maximum.\\n\\nSenior engineer to personally oversee restoration. Residents to be notified via ward SMS alert.',
    'CIVIC ACTION BRIEF: A significant water pipeline leak has been reported at a major junction, creating road subsidence risk.\\n\\nWater Board: (1) Emergency crew to isolate the faulty section within 4 hours, (2) Pipeline repair within 48 hours, (3) Road restoration post-repair within 7 days.\\n\\nRepair must be coordinated with PWD for proper road surface reinstatement.',
  ],
  environment: [
    'CIVIC ACTION BRIEF: Multiple complaints have been received regarding air pollution from industrial activity. Residents are reporting respiratory symptoms.\\n\\nEnvironmental Protection Cell must: (1) Deploy air quality monitoring within 24 hours, (2) Serve stop-work notice to identified factory, (3) File FIR under Environment Protection Act if emission standards are violated.\\n\\nLocal hospital to be alerted to expect increased respiratory patients.',
    'CIVIC ACTION BRIEF: Contamination of a local water body has been reported, threatening ecosystem and public health.\\n\\nEnvironment Department to: (1) Collect water samples for lab analysis within 12 hours, (2) Identify discharge source using upstream tracing, (3) File case under Water Pollution Act against violators.\\n\\nFishing and recreational activities near the water body to be banned until water quality is restored.',
  ],
}

const PREDICTIVE_ALERT_TEMPLATES = [
  { predicted_category: 'flooding', confidence: 0.87, basis_summary: 'A cluster of waterlogging and drainage issues in this area over the past 60 days strongly suggests inadequate stormwater infrastructure. Pre-monsoon flooding risk is very high.' },
  { predicted_category: 'dengue_outbreak', confidence: 0.78, basis_summary: 'Stagnant water reports and garbage overflow issues concentrated in this zone create ideal mosquito breeding conditions. Health department intervention recommended before epidemic season.' },
  { predicted_category: 'road_collapse', confidence: 0.83, basis_summary: 'Multiple water leakage and pothole reports in close proximity suggest subgrade erosion. Historical pattern shows road collapses typically follow sustained water infiltration by 2-3 months.' },
  { predicted_category: 'power_grid_failure', confidence: 0.74, basis_summary: 'Frequent transformer faults and power outage reports indicate aging grid infrastructure. Peak summer load increases probability of cascading failure significantly.' },
  { predicted_category: 'fire_hazard', confidence: 0.71, basis_summary: 'Plastic burning incidents and exposed electrical wires reported in close proximity. Combination significantly elevates fire risk, particularly during dry season.' },
  { predicted_category: 'epidemic_risk', confidence: 0.81, basis_summary: 'Sewage overflow, garbage accumulation, and stagnant water issues clustered in this area for 90+ days. Vector-borne and waterborne disease risk is elevated. Immediate sanitization drive needed.' },
  { predicted_category: 'structural_collapse', confidence: 0.76, basis_summary: 'Reports of damaged old buildings and poor road foundations in this locality. Post-monsoon structural integrity is significantly compromised.' },
  { predicted_category: 'traffic_accident_surge', confidence: 0.79, basis_summary: 'Missing manhole covers, broken road surfaces, and non-functional traffic signals concentrated in this zone predict increase in road accidents over next 30 days.' },
  { predicted_category: 'environmental_degradation', confidence: 0.85, basis_summary: 'Industrial discharge and lake contamination reports indicate a systematic violation pattern. Without intervention, irreversible ecosystem damage expected within 6 months.' },
  { predicted_category: 'water_scarcity_crisis', confidence: 0.72, basis_summary: 'Repeated water supply failures and pipeline leak reports suggest deteriorating distribution network. Prolonged scarcity episodes expected in coming summer months.' },
]

const REASONING_OPTIONS = [
  'Report is consistent with weather conditions at time of filing. GPS location verified. Description contains specific, verifiable details. No red flags for spam.',
  'Credible report from registered user. Location GPS-confirmed. Description matches known infrastructure issues in this ward.',
  'Weather data corroborates the reported issue. Multiple prior reports from same zone increase credibility. Severity rating is proportionate.',
  'Image analysis confirms visible damage consistent with description. No spam indicators detected.',
  'Report aligns with seasonal pattern for this category in this region. GPS coordinates match the described location accurately.',
]

const IMAGE_ANALYSIS_OPTIONS: (string | null)[] = [
  'The image shows significant road damage with a large pothole approximately 2-3 feet in diameter. Visible damage to road surface and underlying gravel. No pedestrian hazard barriers present.',
  'Image depicts overflowing garbage bins with waste scattered on adjacent footpath. Flies visible. Appears to be a collection point that has not been serviced recently.',
  'Photo shows a non-functional streetlight pole. The area appears to be a busy residential street. No temporary lighting present.',
  'Image shows exposed and sparking electrical wires near public infrastructure. High immediate safety risk visible.',
  'Photo depicts a water main pipe with visible leakage forming a puddle on the road surface. Road appears wet over a 5-meter radius.',
  null,
  null, // Some issues have no image
]

const USER_NAMES = [
  'Arjun Sharma', 'Priya Patel', 'Rahul Singh', 'Kavita Menon', 'Suresh Kumar',
  'Anita Desai', 'Vikram Nair', 'Sunita Joshi', 'Ravi Verma', 'Deepa Iyer',
  'Anil Mishra', 'Pooja Reddy', 'Manoj Gupta', 'Lakshmi Pillai', 'Sanjay Thakur',
  'Meena Rao', 'Ajay Bansal', 'Rekha Malhotra', 'Nitin Chaudhary', 'Usha Pandey',
]

const ADMIN_NAMES = ['Admin Ramakrishnan', 'Admin Kapila', 'Admin Desai']

const STREET_NAMES = ['MG Road', 'Station Road', 'Gandhi Nagar', 'Nehru Colony', 'Shivaji Nagar', 'Patel Street', 'Market Road', 'Temple Street']

const CITIES = [...new Set(CITY_CLUSTERS.map(c => c.city))]

// ─── SLA helper ───────────────────────────────────────────────────────────────
const SLA_MAP: Record<string, Record<string, number>> = {
  infrastructure: { high: 24, medium: 72, low: 168 },
  sanitation: { high: 12, medium: 48, low: 96 },
  safety: { high: 6, medium: 24, low: 72 },
  utility: { high: 12, medium: 48, low: 96 },
  environment: { high: 48, medium: 120, low: 240 },
}

function getSlaHours(category: string, severity: number): number {
  const urgency = severity >= 7 ? 'high' : severity >= 4 ? 'medium' : 'low'
  return SLA_MAP[category]?.[urgency] || 72
}

// ─── Status picker ────────────────────────────────────────────────────────────
const STATUS_WEIGHTS = [
  { status: 'open', weight: 20 },
  { status: 'in_progress', weight: 25 },
  { status: 'resolved', weight: 30 },
  { status: 'closed', weight: 15 },
  { status: 'community_review', weight: 10 },
]

function pickStatus(): string {
  const total = STATUS_WEIGHTS.reduce((s, w) => s + w.weight, 0)
  let r = Math.random() * total
  for (const w of STATUS_WEIGHTS) { if (r < w.weight) return w.status; r -= w.weight }
  return 'open'
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌱 CivicPulse India Seed Script')
  console.log('================================\n')

  // ── Step 0: Seed Departments ──────────────────────────────────────────────────
  console.log('📂 Step 0: Seeding departments...')
  await supabase.from('departments').delete().not('id', 'is', null)

  const { data: departments, error: deptErr } = await supabase
    .from('departments')
    .insert([
      { name: 'Public Works Department (PWD)', category_scope: ['infrastructure'], avg_resolution_hours: 72 },
      { name: 'Solid Waste Management (SWM)', category_scope: ['sanitation'], avg_resolution_hours: 48 },
      { name: 'Traffic Police & Safety', category_scope: ['safety'], avg_resolution_hours: 24 },
      { name: 'Water & Electricity Board', category_scope: ['utility'], avg_resolution_hours: 48 },
      { name: 'Environmental Protection & Parks', category_scope: ['environment'], avg_resolution_hours: 120 },
    ])
    .select()

  if (deptErr) { console.error('  ❌ Departments failed:', deptErr.message); process.exit(1) }
  console.log(`  ✅ Seeded ${departments!.length} departments`)

  const deptMap: Record<string, string> = {}
  for (const d of departments!) {
    for (const cat of d.category_scope) deptMap[cat] = d.id
  }

  // ── Step 1: Create Auth Users & Profiles ─────────────────────────────────────
  console.log('\n👤 Step 1: Creating users and profiles...')

  const citizenProfiles: any[] = []
  const adminProfiles: any[] = []

  // Fetch existing users to avoid duplicates
  const { data: existingUsers } = await supabase.auth.admin.listUsers({ perPage: 200 })
  const existingEmails = new Map<string, string>((existingUsers?.users || []).map((u: any) => [u.email, u.id]))

  async function getOrCreateUser(email: string, password: string, fullName: string): Promise<string> {
    if (existingEmails.has(email)) return existingEmails.get(email)!
    const { data, error } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name: fullName }
    })
    if (error) { console.warn(`  ⚠ createUser ${email}:`, error.message); return uuid() }
    return data.user.id
  }

  // Admins
  for (let i = 0; i < ADMIN_NAMES.length; i++) {
    const email = `admin${i + 1}@civicpulse.in`
    const cluster = CITY_CLUSTERS[i * 5] || CITY_CLUSTERS[0]
    const homeLat = jitter(cluster.lat, 0.02)
    const homeLng = jitter(cluster.lng, 0.02)
    const id = await getOrCreateUser(email, 'Admin@123456', ADMIN_NAMES[i])
    adminProfiles.push({
      id, email, role: 'admin',
      karma_score: randInt(200, 500),
      ward_id: randInt(1, 15),
      home_location: `POINT(${homeLng} ${homeLat})`,
      home_address: `${ADMIN_NAMES[i]} Office, ${cluster.city}`,
      created_at: daysAgo(randInt(180, 365)),
    })
  }

  // Citizens
  for (let i = 0; i < USER_NAMES.length; i++) {
    const email = `citizen${i + 1}@civicpulse.in`
    const cluster = CITY_CLUSTERS[i % CITY_CLUSTERS.length]
    const homeLat = jitter(cluster.lat, 0.025)
    const homeLng = jitter(cluster.lng, 0.025)
    const id = await getOrCreateUser(email, 'Citizen@123456', USER_NAMES[i])
    citizenProfiles.push({
      id, email, role: 'citizen',
      karma_score: randInt(10, 300),
      ward_id: randInt(1, 20),
      home_location: `POINT(${homeLng} ${homeLat})`,
      home_address: `${randInt(1, 99)}, ${pick(STREET_NAMES)}, ${cluster.city}`,
      created_at: daysAgo(randInt(30, 300)),
    })
  }

  const allProfiles = [...adminProfiles, ...citizenProfiles]
  for (const p of allProfiles) {
    const { error } = await supabase.from('profiles').upsert(
      { id: p.id, email: p.email, role: p.role, karma_score: p.karma_score,
        ward_id: p.ward_id, home_location: p.home_location, home_address: p.home_address, created_at: p.created_at },
      { onConflict: 'id' }
    )
    if (error) console.warn(`  ⚠ Profile upsert ${p.email}:`, error.message)
  }
  console.log(`  ✅ Created/linked ${allProfiles.length} users (${adminProfiles.length} admins, ${citizenProfiles.length} citizens)`)

  // ── Step 2: Pre-generate cluster IDs & build issues ───────────────────────────
  console.log('\n📋 Step 2: Building clustered issues across India...')

  const clusterInserts: any[] = []
  const allIssues: any[] = []
  const issuesByCluster: Record<number, string[]> = {}

  for (let ci = 0; ci < CITY_CLUSTERS.length; ci++) {
    const cc = CITY_CLUSTERS[ci]
    const clusterId = uuid()
    const issueCount = randInt(4, 9)
    issuesByCluster[ci] = []
    let representativeIssueId: string | null = null

    for (let k = 0; k < issueCount; k++) {
      const issueId = uuid()
      if (k === 0) representativeIssueId = issueId

      const author = pick(citizenProfiles)
      const cat = cc.category
      const severity = cat === 'safety' ? randInt(5, 10) : randInt(2, 9)
      const status = pickStatus()
      const daysBack = randInt(1, 180)
      const createdAt = daysAgo(daysBack)
      const slaHours = getSlaHours(cat, severity)
      const slaDeadline = new Date(new Date(createdAt).getTime() + slaHours * 3600000).toISOString()
      const lat = jitter(cc.lat, cc.spread)
      const lng = jitter(cc.lng, cc.spread)
      const credScore = randInt(5, 10)

      allIssues.push({
        id: issueId,
        user_id: author.id,
        title: pick(ISSUE_TITLES[cat]),
        description: pick(DESCRIPTIONS[cat]),
        category: cat,
        subcategory: pick(SUBCATS[cat]),
        severity,
        is_emergency: severity >= 8,
        status,
        pipeline_stage: 'completed',
        location: `POINT(${lng} ${lat})`,
        address: `${randInt(1, 200)}, ${pick(STREET_NAMES)}, ${cc.city}, ${cc.state}, India`,
        ward_id: randInt(1, 20),
        photo_url: Math.random() > 0.5 ? `https://picsum.photos/seed/${issueId.slice(0, 8)}/400/300` : null,
        credibility_score: credScore,
        cluster_id: clusterId,
        department_id: deptMap[cat] || null,
        needs_community_verification: credScore < 6 || status === 'community_review',
        reasoning: pick(REASONING_OPTIONS),
        civic_brief: pick(CIVIC_BRIEFS[cat]),
        local_civic_brief: null,
        original_language: pick(['English', 'Hindi', 'Marathi', 'Tamil', 'Telugu', 'Kannada', 'Bengali']),
        image_analysis: pick(IMAGE_ANALYSIS_OPTIONS),
        sla_deadline: slaDeadline,
        resolved_at: ['resolved', 'closed'].includes(status) ? daysAgo(randInt(0, daysBack)) : null,
        agent5_completed: true,
        created_at: createdAt,
      })
      issuesByCluster[ci].push(issueId)
    }

    clusterInserts.push({
      id: clusterId,
      representative_issue_id: representativeIssueId!,
      issue_count: issueCount,
      category: cc.category,
    })
  }

  // Standalone issues (30 extra across tier-2 cities)
  const tier2Cities = [
    { city: 'Chandigarh', state: 'Chandigarh', lat: 30.7333, lng: 76.7794 },
    { city: 'Bhopal', state: 'Madhya Pradesh', lat: 23.2599, lng: 77.4126 },
    { city: 'Visakhapatnam', state: 'Andhra Pradesh', lat: 17.6868, lng: 83.2185 },
    { city: 'Surat', state: 'Gujarat', lat: 21.1702, lng: 72.8311 },
    { city: 'Nagpur', state: 'Maharashtra', lat: 21.1458, lng: 79.0882 },
    { city: 'Indore', state: 'Madhya Pradesh', lat: 22.7196, lng: 75.8577 },
    { city: 'Patna', state: 'Bihar', lat: 25.5941, lng: 85.1376 },
    { city: 'Bhubaneswar', state: 'Odisha', lat: 20.2961, lng: 85.8245 },
  ]

  for (let s = 0; s < 30; s++) {
    const tc = pick(tier2Cities)
    const cat = pick(['infrastructure', 'sanitation', 'safety', 'utility', 'environment'] as const)
    const author = pick(citizenProfiles)
    const severity = randInt(2, 8)
    const status = pickStatus()
    const daysBack = randInt(1, 90)
    const createdAt = daysAgo(daysBack)
    const slaHours = getSlaHours(cat, severity)
    const lat = jitter(tc.lat, 0.02)
    const lng = jitter(tc.lng, 0.02)

    allIssues.push({
      id: uuid(),
      user_id: author.id,
      title: pick(ISSUE_TITLES[cat]),
      description: pick(DESCRIPTIONS[cat]),
      category: cat,
      subcategory: pick(SUBCATS[cat]),
      severity,
      is_emergency: severity >= 8,
      status,
      pipeline_stage: 'completed',
      location: `POINT(${lng} ${lat})`,
      address: `Central Zone, ${tc.city}, ${tc.state}, India`,
      ward_id: randInt(1, 20),
      photo_url: null,
      credibility_score: randInt(6, 10),
      cluster_id: null,
      department_id: deptMap[cat] || null,
      needs_community_verification: false,
      reasoning: 'Credible standalone report. Location GPS-confirmed. No duplicate issues in proximity.',
      civic_brief: pick(CIVIC_BRIEFS[cat]),
      original_language: 'English',
      image_analysis: null,
      sla_deadline: new Date(new Date(createdAt).getTime() + slaHours * 3600000).toISOString(),
      resolved_at: ['resolved', 'closed'].includes(status) ? daysAgo(randInt(0, daysBack)) : null,
      agent5_completed: false,
      created_at: createdAt,
    })
  }

  // ── Step 3: Insert clusters FIRST (FK requirement) ────────────────────────────
  console.log('\n🗂  Step 3: Inserting issue clusters...')
  for (let i = 0; i < clusterInserts.length; i += 10) {
    const { error } = await supabase.from('issue_clusters').insert(clusterInserts.slice(i, i + 10))
    if (error) console.error('  ❌ Cluster batch error:', error.message)
  }
  console.log(`  ✅ Created ${clusterInserts.length} issue clusters`)

  // ── Step 4: Insert issues ─────────────────────────────────────────────────────
  console.log(`\n📍 Step 4: Inserting ${allIssues.length} issues...`)
  for (let i = 0; i < allIssues.length; i += 20) {
    const { error } = await supabase.from('issues').insert(allIssues.slice(i, i + 20))
    if (error) console.error(`  ❌ Issues batch ${i}:`, error.message)
    else process.stdout.write('.')
  }
  console.log(`\n  ✅ Inserted ${allIssues.length} issues`)

  // ── Step 5: Verifications ─────────────────────────────────────────────────────
  console.log('\n✔  Step 5: Creating community verifications...')

  const verifiableIssues = allIssues.filter(i => i.needs_community_verification || i.status === 'community_review')
  const verifications: any[] = []
  const seenPairs = new Set<string>()

  for (const issue of verifiableIssues) {
    const verifiers = pickN(citizenProfiles, randInt(1, 4))
    for (const verifier of verifiers) {
      if (verifier.id === issue.user_id) continue
      const key = `${issue.id}_${verifier.id}`
      if (seenPairs.has(key)) continue
      seenPairs.add(key)
      verifications.push({
        id: uuid(),
        issue_id: issue.id,
        user_id: verifier.id,
        verdict: Math.random() > 0.2,
        photo_url: Math.random() > 0.7 ? `https://picsum.photos/seed/${issue.id.slice(0, 6)}/300/200` : null,
        comment: Math.random() > 0.5 ? pick([
          'I walked past this area today, confirmed it is a real problem.',
          'Saw this issue myself yesterday. Very bad condition.',
          'This has been here for weeks. Needs urgent action.',
          'Confirmed. The situation is exactly as described.',
          'I live nearby, can verify this is accurate.',
        ]) : null,
        distance_meters: randInt(10, 500),
        created_at: daysAgo(randInt(0, 10)),
      })
    }
  }

  for (let i = 0; i < verifications.length; i += 20) {
    const { error } = await supabase.from('verifications').insert(verifications.slice(i, i + 20))
    if (error) console.error('  ❌ Verification batch error:', error.message)
  }
  console.log(`  ✅ Created ${verifications.length} verifications`)

  // ── Step 6: Karma Events ──────────────────────────────────────────────────────
  console.log('\n⭐ Step 6: Creating karma events...')

  const karmaEvents: any[] = []
  const karmaPoints: Record<string, number> = {
    report_submitted: 10, verification_approved: 15, verification_denied: -5,
    upvote_received: 5, issue_resolved: 25, comment_added: 3,
  }

  // report_submitted event for every issue
  for (const issue of allIssues) {
    karmaEvents.push({
      id: uuid(), user_id: issue.user_id, event_type: 'report_submitted',
      points: 10, issue_id: issue.id, created_at: issue.created_at,
    })
  }

  // issue_resolved events for resolved/closed issues
  for (const issue of allIssues.filter(i => ['resolved', 'closed'].includes(i.status))) {
    karmaEvents.push({
      id: uuid(), user_id: issue.user_id, event_type: 'issue_resolved',
      points: 25, issue_id: issue.id, created_at: issue.resolved_at || issue.created_at,
    })
  }

  // verification karma
  for (const v of verifications) {
    karmaEvents.push({
      id: uuid(), user_id: v.user_id,
      event_type: v.verdict ? 'verification_approved' : 'verification_denied',
      points: v.verdict ? 15 : -5, issue_id: v.issue_id, created_at: v.created_at,
    })
  }

  // Extra random karma events
  for (let i = 0; i < 80; i++) {
    const user = pick(citizenProfiles)
    const eventType = pick(['upvote_received', 'comment_added'])
    const issue = pick(allIssues)
    karmaEvents.push({
      id: uuid(), user_id: user.id, event_type: eventType,
      points: karmaPoints[eventType] || 5, issue_id: issue.id,
      created_at: daysAgo(randInt(0, 60)),
    })
  }

  for (let i = 0; i < karmaEvents.length; i += 30) {
    const { error } = await supabase.from('karma_events').insert(karmaEvents.slice(i, i + 30))
    if (error) console.error('  ❌ Karma batch error:', error.message)
  }

  // Update karma scores from events
  const karmaByUser: Record<string, number> = {}
  for (const ev of karmaEvents) {
    karmaByUser[ev.user_id] = (karmaByUser[ev.user_id] || 0) + ev.points
  }
  for (const [userId, score] of Object.entries(karmaByUser)) {
    await supabase.from('profiles').update({ karma_score: Math.max(0, score) }).eq('id', userId)
  }
  console.log(`  ✅ Created ${karmaEvents.length} karma events, updated karma scores`)

  // ── Step 7: Predictive Alerts (Agent 5 output) ─────────────────────────────────
  console.log('\n🔮 Step 7: Creating Agent 5 predictive alerts...')

  const predictiveAlerts: any[] = []

  for (let ci = 0; ci < CITY_CLUSTERS.length; ci++) {
    const cc = CITY_CLUSTERS[ci]
    const numAlerts = Math.random() > 0.55 ? 2 : 1

    for (let a = 0; a < numAlerts; a++) {
      const template = pick(PREDICTIVE_ALERT_TEMPLATES)
      const predDate = daysAgo(randInt(1, 30))
      predictiveAlerts.push({
        ward_id: randInt(1, 20),
        predicted_category: template.predicted_category,
        confidence: parseFloat(Math.min(0.99, Math.max(0.50, template.confidence + randFloat(-0.05, 0.05))).toFixed(2)),
        prediction_date: predDate,
        basis_summary: template.basis_summary,
        location: `POINT(${jitter(cc.lng, 0.005)} ${jitter(cc.lat, 0.005)})`,
        address: `${cc.label}, ${cc.city}, ${cc.state}`,
        is_actioned: Math.random() > 0.7,
        created_at: predDate,
      })
    }
  }

  // Metro-level aggregate alerts
  const metros = [
    { city: 'Mumbai', state: 'Maharashtra', lat: 19.0760, lng: 72.8777 },
    { city: 'New Delhi', state: 'Delhi', lat: 28.6139, lng: 77.2090 },
    { city: 'Bengaluru', state: 'Karnataka', lat: 12.9716, lng: 77.5946 },
    { city: 'Hyderabad', state: 'Telangana', lat: 17.3850, lng: 78.4867 },
    { city: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lng: 80.2707 },
  ]
  for (const metro of metros) {
    predictiveAlerts.push({
      ward_id: randInt(1, 30),
      predicted_category: pick(['epidemic_risk', 'flooding', 'road_collapse']),
      confidence: parseFloat(randFloat(0.78, 0.96).toFixed(2)),
      prediction_date: daysAgo(randInt(1, 7)),
      basis_summary: `High-density cluster of civic issues detected in ${metro.city} metropolitan zone over the past 60 days. Predictive model indicates elevated risk of cascading civic failures without immediate intervention from multiple departments.`,
      location: `POINT(${jitter(metro.lng, 0.01)} ${jitter(metro.lat, 0.01)})`,
      address: `Metro Zone Alert — ${metro.city}, ${metro.state}`,
      is_actioned: false,
      created_at: daysAgo(randInt(1, 7)),
    })
  }

  for (let i = 0; i < predictiveAlerts.length; i += 20) {
    const { error } = await supabase.from('predictive_alerts').insert(predictiveAlerts.slice(i, i + 20))
    if (error) console.error('  ❌ Predictive alerts batch error:', error.message)
  }
  console.log(`  ✅ Created ${predictiveAlerts.length} predictive alerts`)

  // ── Summary ───────────────────────────────────────────────────────────────────
  console.log('\n🎉 Seeding Complete!')
  console.log('═══════════════════════════════════════')
  console.log(`  👤 Users          : ${allProfiles.length} (${adminProfiles.length} admins, ${citizenProfiles.length} citizens)`)
  console.log(`  📋 Issues         : ${allIssues.length} across ${CITIES.length}+ cities + 8 tier-2 cities`)
  console.log(`  🗂  Clusters       : ${clusterInserts.length} (tight geo hotspots for KMeans demo)`)
  console.log(`  ✔  Verifications  : ${verifications.length}`)
  console.log(`  ⭐ Karma Events   : ${karmaEvents.length}`)
  console.log(`  🔮 Predict Alerts : ${predictiveAlerts.length}`)
  console.log('═══════════════════════════════════════')
  console.log('\nCity breakdown:')
  for (const city of CITIES) {
    const cnt = allIssues.filter(i => i.address?.includes(city)).length
    console.log(`  • ${city}: ${cnt} issues`)
  }
  console.log('\n✨ Ready to demo KMeans clustering, route planning, and predictive analytics!')
}

main().catch(err => {
  console.error('\n💥 Seed script failed:', err)
  process.exit(1)
})
