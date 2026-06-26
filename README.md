# CivicPulse 🏙️
An AI-powered civic issue reporting platform for Indian cities. Built to solve urban challenges by empowering citizens to report civic problems, which are then autonomously classified, deduplicated, validated, routed, and enriched by five localized LangGraph AI agents.

## 🚀 The Vision
Civic problems—potholes, sanitation issues, broken streetlights—often go unresolved due to bureaucratic bottlenecks, duplicate reporting, and lack of actionable data. CivicPulse acts as an intelligent intermediary. It takes raw citizen reports (text + images), uses AI to validate and classify them, checks for semantic and spatial duplicates using vector databases and GIS, and generates a structured, actionable brief for the relevant civic department.

## 🛠️ Technology Stack
* **Framework:** Next.js 15 (App Router, Turbopack) & React 19
* **Language:** TypeScript
* **Styling:** Tailwind CSS + shadcn/ui (Radix UI)
* **Database & Auth:** Supabase (PostgreSQL, Auth, Storage)
* **Extensions:** PostGIS (Spatial Data), pgvector (Semantic Search)
* **AI & Orchestration:** 
  * @langchain/langgraph & @langchain/core for agentic pipelines
  * @google/generative-ai (Gemini 2.5 Flash / Pro)
  * Multi-provider client wrapper supporting Ollama (local) and cloud providers
* **Maps:** Leaflet & eact-leaflet for map rendering, Google Maps Geocoding API for address resolution.
* **Package Manager:** un

---

## ⚙️ Implemented Features & Modules

### 1. Authentication System
* **Methods:** Google OAuth and Email Magic Link powered by Supabase Auth.
* **Guard:** Next.js Middleware protects /dashboard, /report, and /admin routes.
* **Profiles:** Auth triggers automatically provision a public.profiles row for every user, managing roles (citizen vs dmin), karma scores, and home locations.

### 2. Citizen Dashboard (/dashboard)
* **Real-time Map Visualization:** Uses Leaflet to plot active civic issues.
* **PostGIS Decoding:** The API (/api/issues/map) actively decodes PostGIS WKB (Well-Known Binary) hex strings into GeoJSON/lat-lng objects via wkx for frontend rendering.
* **Community Verification Tracking:** Issues flagged for community review (low AI credibility) pulse with distinct orange UI indicators on the map.
* **GPS Integration:** "Locate Me" map control uses browser geolocation to instantly center the dashboard on the user's current location via Leaflet's lyTo mechanics.

### 3. Smart Issue Reporting (/report)
* **Map Picker:** Interactive map allowing users to drop a pin. Includes a custom-built non-blocking UI overlay and a "Locate Me" control.
* **Address Resolution:** Reverse geocodes the dropped pin coordinates via Google Maps API.
* **Media Uploads:** Directly uploads image evidence to the Supabase issue-media storage bucket.

### 4. Synthetic Data Generation (scripts/generate-data.ts)
* A robust Faker.js script that populates the database with synthetic users, profiles, issues, verifications, and karma events.
* Distributes issues across 12 major Indian regions (Mumbai, Delhi, Bengaluru, etc.) using weighted probabilities and geographical jitter (10-20km radius).
* Emits a seed.sql file designed for conflict-free ON CONFLICT DO UPDATE execution in the Supabase SQL editor to bypass CSV upload limitations and auth triggers.

---

## 🧠 AI Agent Pipeline (LangGraph)

When a citizen submits a report to /api/reports/process, it enters a synchronous LangGraph StateGraph pipeline containing 4 primary AI agents.

### Agent 1: Classifier (gent1-classifier.ts)
* **Vision & Text Analysis:** Evaluates the user's text description and attached image (via Gemini 2.5 Flash Vision).
* **Routing:** Outputs structured JSON containing the category, subcategory, severity (1-10), and emergency status.
* **Action:** Maps the issue to the correct civic department by querying the departments table's category_scope.

### Agent 2: Deduplication (gent2-deduplication.ts)
* **Semantic Search:** Embeds the report description (	ext-embedding-004) and executes the match_issues Supabase RPC to find similar issues using cosine similarity (threshold >= 0.85).
* **Spatial Fallback:** If no semantic match exists, it triggers the issues_within_radius PostGIS RPC to find identical category issues within a 200-meter radius.
* **Action:** Groups duplicates into issue_clusters to prevent civic worker fatigue.

### Agent 3: Validation (gent3-validation.ts)
* **Context Gathering:** Fetches live and historical weather data for the coordinates via the Open-Meteo API.
* **Credibility Scoring:** The AI cross-references the report claims against weather truth (e.g., "flooding" during a drought is flagged).
* **Action:** Outputs a credibility score. If < 6, the issue is flagged with 
eeds_community_verification, pushing it to the community verification feed.

### Agent 4: Resolution (gent4-resolution.ts)
* **Historical Context:** Retrieves the last 3 issues at the same location to provide historical awareness to civic workers.
* **SLA Calculation:** Computes the Service Level Agreement deadline based on a category/severity urgency matrix.
* **Action:** Generates a structured, professional 150-200 word Civic Action Brief outlining Evidence, Urgency, Context, and Recommended Action for city officials.

### State Persistence (saveToDatabase)
* The final graph node unwraps the agent state and executes the database updates via Supabase service role, persisting the classification, brief, SLA, and clustering decisions.

---

## 🗄️ Database Schema & PostGIS

* **profiles**: Extends uth.users. Tracks karma_score, ole, and ward_id.
* **departments**: Civic departments with a category_scope array.
* **issues**: The core table. 
  * Uses PostGIS geography(Point, 4326) for precise spatial tracking (location column).
  * Uses pgvector ector(768) for semantic deduplication (embedding column).
* **issue_clusters**: Aggregates duplicate reports.
* **erifications**: Ledger for community review. Uses a composite unique key (issue_id, user_id) to prevent duplicate voting.
* **karma_events**: Audit log of citizen karma transactions.

---

## 💻 Getting Started

### 1. Prerequisites
* [Bun](https://bun.sh/) installed.
* A Supabase project with PostGIS and pgvector enabled.
* API keys: Gemini, Google Maps, Mapbox.

### 2. Configuration
Create a \.env.local\ file in the root directory:
\\\env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GEMINI_API_KEY=your-gemini-api-key
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
NEXT_PUBLIC_MAPBOX_TOKEN=your-mapbox-token
NEXT_PUBLIC_APP_URL=http://localhost:3000
\\\

### 3. Installation & Database Setup
\\\ash
bun install
# To seed the database with nationwide synthetic data:
bun run scripts/generate-data.ts
# (Then run the generated scripts/seed.sql in your Supabase SQL Editor)
\\\

### 4. Running Locally
\\\ash
bun run dev
\\\
Open [http://localhost:3000](http://localhost:3000) to view the application.