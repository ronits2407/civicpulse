import { faker } from '@faker-js/faker'
import fs from 'fs'

const SEED_USERS = 20
const SEED_ISSUES = 50
const SEED_VERIFICATIONS = 40
const SEED_KARMA = 60

const NASHIK_CENTER = { lat: 19.9975, lng: 73.7898 }

// --- Helpers ---
const randomUUID = () => faker.string.uuid()
const randomChoice = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]

const categories = ['infrastructure', 'sanitation', 'safety', 'utility', 'environment']
const statuses = ['open', 'in_progress', 'resolved', 'closed', 'community_review']

function escapeSql(str: string | null) {
  if (!str) return 'NULL'
  return `'${str.replace(/'/g, "''")}'`
}

function escapeCsv(str: string | null | number | boolean) {
  if (str === null || str === undefined) return ''
  const s = String(str)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

async function main() {
  console.log('Generating synthetic seed data...')

  const users: any[] = []
  const profiles: any[] = []
  const issues: any[] = []
  const verifications: any[] = []
  const karma: any[] = []

  // 1. Generate Users & Profiles
  for (let i = 0; i < SEED_USERS; i++) {
    const id = randomUUID()
    const email = faker.internet.email()
    const role = i === 0 ? 'admin' : 'citizen' // Make first user admin

    users.push({ id, email })
    profiles.push({
      id,
      email,
      phone: null,
      role,
      karma_score: faker.number.int({ min: 10, max: 500 }),
      ward_id: faker.number.int({ min: 1, max: 10 }),
      created_at: faker.date.past({ years: 1 }).toISOString(),
    })
  }

  // 2. Generate Issues
  for (let i = 0; i < SEED_ISSUES; i++) {
    const userId = randomChoice(profiles).id
    const category = randomChoice(categories)
    const status = randomChoice(statuses)
    
    // Slight jitter around Nashik
    const lat = NASHIK_CENTER.lat + (Math.random() - 0.5) * 0.05
    const lng = NASHIK_CENTER.lng + (Math.random() - 0.5) * 0.05

    issues.push({
      id: randomUUID(),
      user_id: userId,
      title: faker.lorem.sentence({ min: 4, max: 8 }),
      description: faker.lorem.paragraph(),
      category,
      severity: faker.number.int({ min: 1, max: 10 }),
      is_emergency: faker.datatype.boolean({ probability: 0.1 }),
      status,
      location: `POINT(${lng} ${lat})`, // WKT format for PostGIS / CSV
      address: faker.location.streetAddress() + ', Nashik, Maharashtra',
      ward_id: faker.number.int({ min: 1, max: 10 }),
      needs_community_verification: status === 'community_review',
      credibility_score: faker.number.int({ min: 3, max: 10 }),
      created_at: faker.date.recent({ days: 30 }).toISOString(),
    })
  }

  // 3. Generate Verifications
  const communityReviewIssues = issues.filter(i => i.status === 'community_review' || i.status === 'open')
  for (let i = 0; i < SEED_VERIFICATIONS; i++) {
    if (communityReviewIssues.length === 0) break
    const issueId = randomChoice(communityReviewIssues).id
    const userId = randomChoice(profiles).id

    verifications.push({
      id: randomUUID(),
      issue_id: issueId,
      user_id: userId,
      verdict: faker.datatype.boolean({ probability: 0.8 }),
      created_at: faker.date.recent({ days: 10 }).toISOString(),
    })
  }

  // 4. Generate Karma Events
  for (let i = 0; i < SEED_KARMA; i++) {
    const userId = randomChoice(profiles).id
    const issueId = faker.datatype.boolean() ? randomChoice(issues).id : null

    karma.push({
      id: randomUUID(),
      user_id: userId,
      event_type: randomChoice(['report_submitted', 'verification_approved', 'upvote_received']),
      points: faker.number.int({ min: 5, max: 50 }),
      issue_id: issueId,
      created_at: faker.date.recent({ days: 30 }).toISOString(),
    })
  }

  // --- WRITE CSVs ---
  const writeCsv = (filename: string, headers: string[], rows: any[]) => {
    const headerRow = headers.join(',')
    const dataRows = rows.map(r => headers.map(h => escapeCsv(r[h])).join(','))
    fs.writeFileSync(filename, [headerRow, ...dataRows].join('\n'), 'utf8')
    console.log(`Generated ${filename} (${rows.length} rows)`)
  }

  writeCsv('scripts/profiles.csv', ['id', 'email', 'role', 'karma_score', 'ward_id', 'created_at'], profiles)
  writeCsv('scripts/issues.csv', ['id', 'user_id', 'title', 'description', 'category', 'severity', 'is_emergency', 'status', 'location', 'address', 'ward_id', 'needs_community_verification', 'credibility_score', 'created_at'], issues)
  writeCsv('scripts/verifications.csv', ['id', 'issue_id', 'user_id', 'verdict', 'created_at'], verifications)
  writeCsv('scripts/karma_events.csv', ['id', 'user_id', 'event_type', 'points', 'issue_id', 'created_at'], karma)

  // --- WRITE SQL ---
  let sql = `-- CivicPulse Seed Data
-- Run this in the Supabase SQL Editor

-- 1. Create dummy auth users (needed for profiles FK)
`
  for (const u of users) {
    sql += `INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES ('00000000-0000-0000-0000-000000000000', '${u.id}', 'authenticated', 'authenticated', '${u.email}', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '') ON CONFLICT (id) DO NOTHING;\n`
  }

  sql += `\n-- 2. Profiles\n`
  for (const p of profiles) {
    sql += `INSERT INTO public.profiles (id, email, role, karma_score, ward_id, created_at) VALUES ('${p.id}', '${p.email}', '${p.role}', ${p.karma_score}, ${p.ward_id}, '${p.created_at}') ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, karma_score = EXCLUDED.karma_score, ward_id = EXCLUDED.ward_id;\n`
  }

  sql += `\n-- 3. Issues\n`
  for (const i of issues) {
    sql += `INSERT INTO public.issues (id, user_id, title, description, category, severity, is_emergency, status, location, address, ward_id, needs_community_verification, credibility_score, created_at) 
VALUES ('${i.id}', '${i.user_id}', ${escapeSql(i.title)}, ${escapeSql(i.description)}, '${i.category}', ${i.severity}, ${i.is_emergency}, '${i.status}', ST_GeogFromText('${i.location}'), ${escapeSql(i.address)}, ${i.ward_id}, ${i.needs_community_verification}, ${i.credibility_score}, '${i.created_at}') ON CONFLICT (id) DO NOTHING;\n`
  }

  sql += `\n-- 4. Verifications\n`
  for (const v of verifications) {
    sql += `INSERT INTO public.verifications (id, issue_id, user_id, verdict, created_at) VALUES ('${v.id}', '${v.issue_id}', '${v.user_id}', ${v.verdict}, '${v.created_at}') ON CONFLICT (id) DO NOTHING;\n`
  }

  sql += `\n-- 5. Karma Events\n`
  for (const k of karma) {
    sql += `INSERT INTO public.karma_events (id, user_id, event_type, points, issue_id, created_at) VALUES ('${k.id}', '${k.user_id}', '${k.event_type}', ${k.points}, ${k.issue_id ? `'${k.issue_id}'` : 'NULL'}, '${k.created_at}') ON CONFLICT (id) DO NOTHING;\n`
  }

  fs.writeFileSync('scripts/seed.sql', sql, 'utf8')
  console.log(`Generated scripts/seed.sql`)
  console.log('Done! All data is consistent.')
}

main()