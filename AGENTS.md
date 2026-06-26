<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

<!-- BEGIN:civicpulse-project-context -->
# CivicPulse — Project Context for AI Sessions

## What This Is
An AI-powered civic issue reporting platform for Indian cities (specifically Nashik). Citizens report civic problems; five LangGraph AI agents classify, deduplicate, validate, route, and generate predictive insights. Built for a hackathon with a "deployed on Google Cloud" requirement.

## Tech Stack (locked in, do not change)
- **Framework**: Next.js 15 (App Router, TypeScript, no src dir, flat structure). Currently running **Next.js 16.2.9 with Turbopack**.
- **Package manager**: `bun` — always use `bun add`, `bun run`, `bunx` instead of npm/npx
- **Styling**: Tailwind CSS + shadcn/ui (Radix preset, Mira theme, Slate base color)
- **AI**: `@google/generative-ai` — Gemini 2.5 Flash (agents 1–4), Gemini 2.5 Pro (agent 5 async), `text-embedding-004` for pgvector embeddings. Includes `openai` for Ollama cloud/local support.
- **Agent orchestration**: `@langchain/langgraph` + `@langchain/core`
- **Database**: Supabase (Postgres + PostGIS + pgvector + Realtime + Auth + Storage)
- **Maps**: Mapbox GL JS (frontend rendering) + Google Maps Geocoding API + Google Maps Static API (backend only)
- **Auth**: Supabase Auth — Google OAuth + email magic link (no Twilio/SMS for now)
- **Deployment**: Google Cloud Run (asia-south1), Docker image pushed to Artifact Registry

## Folder Structure
```
/app                        → Next.js App Router pages
/app/api                    → API route handlers
/app/auth/login/page.tsx    → Login page (Google OAuth + email OTP)
/app/auth/callback/route.ts → OAuth callback handler
/app/dashboard/page.tsx     → Citizen dashboard (server component)
/app/report/page.tsx        → Report submission page
/components/ui              → shadcn components
/components/dashboard/      → DashboardClient.tsx (realtime Supabase listener)
/lib/agents/                → LangGraph nodes (one file per agent + pipeline.ts)
/lib/ai/client.ts           → Unified AI API wrapper (Gemini / Ollama, Flash, Pro, embeddings, image analysis)
/lib/db/client.ts           → Supabase clients (browser, server, service role)
/lib/db/types.ts            → All TypeScript types (Issue, Profile, AgentState, etc.)
/lib/auth/actions.ts        → Server actions: signInWithGoogle, signInWithEmail, signOut, getUser
/lib/maps/                  → (not yet created) Mapbox config, Google Geocoding wrapper
/lib/push/                  → (not yet created) Web Push subscription management
/middleware.ts              → Auth guard for /dashboard, /report, /admin routes
/Dockerfile                 → Cloud Run container (node:20-alpine, bun, standalone output)
```

## Database Schema (all tables created in Supabase)
- `profiles` — extends auth.users, has role (citizen/admin), karma_score, push_subscription
- `departments` — civic departments with category_scope[]
- `issue_clusters` — groups of duplicate/nearby issues
- `issues` — core table: location (PostGIS geography), embedding (vector 768), status, civic_brief, sla_deadline
- `verifications` — community verify verdicts
- `karma_events` — ledger of karma points
- `upvotes` — issue upvotes
- `predictive_alerts` — Agent 5 async output

### Supabase SQL functions created:
- `match_issues(query_embedding, match_threshold, match_count)` — pgvector cosine similarity
- `issues_within_radius(lat, lng, radius_meters, category)` — PostGIS proximity search
- `increment_cluster_count(cluster_id)` — cluster size counter

## Five AI Agents (LangGraph pipeline, `/api/reports/process`)
1. **Classifier** (`agent1-classifier.ts`) — Gemini Flash, structured JSON output: category, subcategory, severity 1–10, is_emergency, suggested_title
2. **Deduplication** (`agent2-deduplication.ts`) — pgvector cosine similarity (threshold 0.85) + PostGIS 200m radius fallback
3. **Validation** (`agent3-validation.ts`) — Open-Meteo weather API + Gemini credibility score 1–10; triggers community push if < 6
4. **Resolution** (`agent4-resolution.ts`) — Gemini generates civic action brief (150–200 words), computes SLA deadline from severity/category matrix
5. **Predictive** (`agent5-predictive.ts`) — NOT YET BUILT. Async Cloud Run scheduled job, Gemini Pro, writes to `predictive_alerts`

## What Is Built and Working (as of session end)
- ✅ `lib/db/client.ts` — all three Supabase clients
- ✅ `lib/db/types.ts` — all TypeScript interfaces
- ✅ `lib/ai/client.ts` — Unified multi-provider AI client (Gemini/Ollama), Flash, Pro, embedding, image analysis, structured JSON helpers
- ✅ `app/api/geocode/route.ts` — Google Maps Geocoding API wrapper
- ✅ `lib/agents/agent1-classifier.ts` through `agent4-resolution.ts`
- ✅ `lib/agents/pipeline.ts` — LangGraph StateGraph wiring all 4 nodes + saveToDatabase
- ✅ `app/api/reports/process/route.ts` — main pipeline entry point
- ✅ `middleware.ts` — auth guard
- ✅ `app/auth/callback/route.ts` — OAuth code exchange
- ✅ `lib/auth/actions.ts` — server actions (signInWithGoogle, signInWithEmail, signOut, getUser)
- ✅ `app/auth/login/page.tsx` — Google + email magic link login UI
- ✅ `app/report/page.tsx` — full citizen report submission flow with geolocation + image upload
- ✅ `app/dashboard/page.tsx` + `components/dashboard/DashboardClient.tsx` — citizen dashboard with realtime updates
- ✅ `app/layout.tsx` + `app/page.tsx` — root layout and landing page
- ✅ `app/api/test/route.ts` — env var health check at /api/test

## What Is NOT Yet Built
- [ ] Admin dashboard (`/admin`) — civic inbox, heatmap (Mapbox), SLA tracker, AI reasoning panel, predictive hotspot panel
- [ ] Agent 5 — async predictive insights job
- [ ] Web Push notification flow (`lib/push/`)
- [ ] `/receipt/[issue_id]` — Impact Receipt shareable card (next/og)
- [ ] Seed script (Faker.js, 6 months of synthetic Nashik data)
- [ ] Community verification UI
- [ ] Maps integration (`lib/maps/`) — Mapbox GL JS frontend rendering

## Environment Variables Required (all in `.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY
GOOGLE_MAPS_API_KEY
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY   ← same value as above, needed client-side for geocoding
NEXT_PUBLIC_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
NEXT_PUBLIC_MAPBOX_TOKEN
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_EMAIL
NEXT_PUBLIC_APP_URL
```

## Key Decisions Made
- No Twilio SMS OTP — using email magic link + Google OAuth only
- No `supabase start` / local Docker — working against remote Supabase project directly
- Google Cloud billing is resolved; Cloud Run deployment is the target
- `output: 'standalone'` set in `next.config.ts` for Docker
- Supabase Auth redirect: `NEXT_PUBLIC_APP_URL/auth/callback`
- Storage bucket: `issue-media` (public read, auth write)
- Realtime enabled on `issues` and `predictive_alerts` tables

## Next Steps (in order)
1. Verify `/api/test` returns all keys as "set"
2. Test full citizen flow: login → report → agent pipeline → result card
3. Build admin dashboard: `/admin/login`, `/admin/dashboard` with Mapbox heatmap, SLA inbox, AI reasoning trace
4. Build Agent 5 scheduled job
5. Build `/receipt/[issue_id]` OG image route
6. Seed script with Faker.js
7. Cloud Run deployment
<!-- END:civicpulse-project-context -->
