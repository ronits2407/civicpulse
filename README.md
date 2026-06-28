# 🏙️ CivicPulse — Next-Generation AI Civic Issue Intelligence Platform

CivicPulse is an intelligent, agentic civic issue reporting platform designed to eliminate bureaucratic bottlenecks, citizen apathy, and duplicate reporting in urban governance (specifically tailored for Indian cities like Nashik). 

It empowers citizens to report civic problems through an accessible interface, while an autonomous **5-Agent LangGraph AI Pipeline** handles classification, spatial deduplication, credibility validation, resolution briefing, and predictive hotspot analysis.

---

## 🌟 The Vision & Problem Statement
Urban civic problems—potholes, sanitation issues, broken streetlights—often go unresolved due to lack of actionable data and duplicate reporting. CivicPulse acts as a **smart AI intermediary**. It accepts raw citizen reports (text, images, or **voice**), leverages computer vision and semantic search to understand the problem, ensures the issue isn't already reported using vector similarity and GIS spatial data, and finally hands over a highly structured, actionable brief to the relevant civic department.

---

## 🔥 Key Innovations (Why This Wins)

We've implemented a robust set of features to maximize accessibility, agentic depth, and production-readiness.

### 🎙️ Voice Reporting (Web Speech API)
**The Feature:** True accessibility for all demographics. Citizens can simply click the microphone icon and dictate their issue (e.g., "There's a massive pothole near the central temple...").
**The Tech:** Leverages browser-native Web Speech API to transcribe voice directly into the report description, seamlessly tying into our multi-modal submission flow.

### 🌐 Multilingual Civic Reporting
**The Feature:** Built for India's linguistic diversity. Reports submitted in regional languages are autonomously handled, ensuring non-English speakers aren't alienated from civic participation.

### 🧠 Multi-Model AI Ecosystem
**The Feature:** A unified AI wrapper (`lib/ai/client.ts`) that orchestrates between **Google Gemini 2.5 Flash / Pro** (for lightning-fast classification and deep reasoning) and **Ollama** (for local/cloud flexible fallback). We use `text-embedding-004` for creating 768-dimensional vectors.

### 🔮 Predictive Hotspot Intelligence (Agent 5)
**The Feature:** Moving from reactive fixing to **proactive urban planning**. 
**The UI Flow:** Inside the Admin Dashboard Map Interface, officials click the **"Analyse Issues"** button. This triggers **Agent 5 (Predictive Analysis)** using Gemini Pro. The agent analyzes historical spatiotemporal data and generates predictive alerts (e.g., "78% chance of waterlogging in Ward 4 next monsoon based on current drainage reports"). 

### 🗺️ Real-Time Map Dashboard & Aesthetic UI
**The Feature:** A breathtaking, glassmorphic UI equipped with Mapbox GL JS map rendering. 
**The UI Flow:** Citizens and Admins see real-time map pins drop as issues are reported. We've optimized map pins to be sleek and aesthetically pleasing, significantly improving the administrative map interface's utility and visual hierarchy.

---

## 🤖 The 5-Agent LangGraph Pipeline

When a report hits `/api/reports/process`, it enters our **LangGraph StateGraph**, moving autonomously through highly specialized AI agents:

1. **Agent 1: Classifier** (Gemini 2.5 Flash Vision)
   - Evaluates text + image evidence.
   - Routes the issue to the correct civic department and calculates severity (1-10).
2. **Agent 2: Deduplication** (pgvector + PostGIS)
   - Creates a vector embedding of the report.
   - Runs a `match_issues` Supabase RPC for semantic cosine similarity (≥ 0.85).
   - Runs a spatial fallback via PostGIS (`issues_within_radius`) to group identical issues within a 200m radius into `issue_clusters`.
3. **Agent 3: Validation** (Credibility Check)
   - Cross-references claims with real-world context (e.g., checks Open-Meteo API for weather conditions). 
   - Assigns a credibility score. (Prevents fake reporting).
4. **Agent 4: Resolution** (Civic Action Briefs)
   - Calculates dynamic SLA deadlines based on the urgency matrix.
   - Generates a professional 150-200 word Civic Action Brief for the exact workers handling the issue.
5. **Agent 5: Predictive (Admin Triggered)**
   - Gemini Pro synthesizes macro-trends across the dataset and writes to `predictive_alerts` for long-term city planning.

---

## 🛠️ Production-Optimized Tech Stack

* **Framework:** Next.js 16.2.9 (App Router, Turbopack)
* **Language:** TypeScript (Strict Mode)
* **Package Manager:** `bun`
* **Styling:** Tailwind CSS + shadcn/ui (Radix UI, Mira theme, Slate base)
* **Database & Auth:** Supabase (PostgreSQL, Auth, Storage)
* **Spatial & Semantic DB:** PostGIS, pgvector
* **AI Orchestration:** `@langchain/langgraph` + `@langchain/core`
* **Maps:** Mapbox GL JS + Google Maps Geocoding API
* **Deployment target:** Google Cloud Run (asia-south1) using Docker.

**Codebase Health:** The repository is fully optimized for production. All redundant components, unreachable code, and scratch scripts have been aggressively pruned to ensure maximum execution efficiency and clean architecture. Test suites are modularized in the `./tests` directory.

---

## 🗄️ Database Architecture

* **`profiles`**: Extends auth.users. Tracks roles, karma_score.
* **`issues`**: Core table utilizing `geography(Point, 4326)` for spatial tracking and `vector(768)` for semantic deduplication.
* **`issue_clusters`**: Groups identical reports to prevent civic worker fatigue.
* **`predictive_alerts`**: Stores Agent 5 insights.
* **`karma_events`**: Immutable ledger of citizen points.

---

## 🚀 Getting Started

### 1. Prerequisites
* [Bun](https://bun.sh/) installed.
* Supabase project with PostGIS and pgvector enabled.
* API Keys: Gemini, Google Maps, Mapbox.

### 2. Environment Variables
Create a `.env.local` file:
```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
GEMINI_API_KEY=...
GOOGLE_MAPS_API_KEY=...
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...
NEXT_PUBLIC_MAPBOX_TOKEN=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Quickstart
```bash
# Install dependencies instantly with Bun
bun install

# Run the Next.js Turbopack dev server
bun dev
```

Visit `http://localhost:3000` to experience the future of civic governance!