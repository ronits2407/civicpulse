import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE credentials")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// Rough Nashik bounds
const NASHIK_BOUNDS = {
  minLat: 19.95, maxLat: 20.05,
  minLng: 73.75, maxLng: 73.85
}

function randomInRange(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

const CATEGORIES = ['waterlogging', 'potholes', 'garbage', 'streetlights', 'stray_animals']

async function seed() {
  console.log("Seeding synthetic data for Predictive Alerts testing...")

  // Generate 200 past issues over the last 6 months
  const issues = [];
  const now = new Date();

  // Create a few hotpots manually
  const hotspots = [
    { lat: 19.997, lng: 73.789, category: 'waterlogging' }, // Panchavati area
    { lat: 20.005, lng: 73.765, category: 'potholes' } // College Road area
  ];

  for (let i = 0; i < 200; i++) {
    const isHotspot = Math.random() > 0.5; // 50% chance to be in a hotspot
    
    let lat, lng, category;
    
    if (isHotspot) {
      const hotspot = hotspots[Math.floor(Math.random() * hotspots.length)];
      lat = randomInRange(hotspot.lat - 0.005, hotspot.lat + 0.005);
      lng = randomInRange(hotspot.lng - 0.005, hotspot.lng + 0.005);
      category = hotspot.category;
    } else {
      lat = randomInRange(NASHIK_BOUNDS.minLat, NASHIK_BOUNDS.minLat);
      lng = randomInRange(NASHIK_BOUNDS.minLng, NASHIK_BOUNDS.minLng);
      category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    }

    // Random date within last 6 months
    const daysAgo = Math.floor(Math.random() * 180);
    const date = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));

    issues.push({
      title: `Synthetic ${category} issue`,
      description: `Test description for ${category} at ${lat}, ${lng}`,
      category,
      severity: Math.floor(randomInRange(3, 10)),
      status: 'closed', // They are historical issues
      location: `POINT(${lng} ${lat})`,
      created_at: date.toISOString()
    });
  }

  const { error } = await supabase.from('issues').insert(issues);
  
  if (error) {
    console.error("Failed to seed issues:", error);
  } else {
    console.log("✅ Seeded 200 synthetic issues in Nashik region.");
  }
}

seed().catch(console.error);
