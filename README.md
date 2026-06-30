# 🏙️ CivicPulse — AI-Powered Civic Issue Reporting Platform

**Hackathon Submission — Problem Statement 2: Community Hero (Hyperlocal Problem Solver)**

CivicPulse is a full-stack, AI-powered civic issue reporting platform designed for Indian cities. Citizens report infrastructure, sanitation, safety, utility, and environmental problems via text, photo, video, or voice. A **six-agent LangGraph pipeline** powered by Google Gemini 2.5 Flash and Pro automatically classifies, deduplicates, validates, generates resolution briefs, and predicts future civic hotspots.

The platform is deployed live on Google Cloud Run with a complete CI/CD pipeline. It supports any typed language via automatic translation, community verification with quorum-based voting, karma gamification, TSP-optimised field team routing, and a fully featured admin dashboard.

---

## 🌟 Project Highlights

* **6 AI agents** orchestrated by LangGraph with conditional branching and retry/resume.
* **3-layer deduplication:** pgvector cosine similarity + PostGIS spatial search + Gemini semantic verification.
* **Any typed language supported** via automatic detection and translation (Agent 0).
* **TSP-optimised routing** for municipal field teams via Google Maps Routes API.
* **Community verification** with quorum-based voting and karma gamification.
* **Predictive hotspot analysis** using geographic DBSCAN clustering + Gemini 2.5 Pro.
* **Deployed live** on Google Cloud Run with zero-credential CI/CD (Workload Identity Federation).

---

## 🤖 The 6-Agent LangGraph Pipeline

When a report is submitted, it enters our LangGraph `StateGraph`, moving autonomously through specialized AI agents:

1. **Agent 0: Translation** 
   - Detects the language of the report and translates it to English to standardize downstream processing. 
   - Preserves the original language and translation trace.
2. **Agent 1: Classifier** (Gemini 2.5 Flash Vision)
   - Evaluates text + image evidence.
   - Extracts Category, Subcategory, Severity (1-10), and identifies if it's an emergency.
3. **Agent 2: Deduplication** (pgvector + PostGIS + Gemini)
   - **Layer 1:** pgvector cosine similarity (≥ 0.85).
   - **Layer 2:** PostGIS spatial search (`ST_DWithin` 200m).
   - **Layer 3:** AI semantic verification as the final judge to distinguish distinct but similar reports.
4. **Agent 3: Validation** (Credibility Check)
   - Fetches live weather data from Open-Meteo if relevant.
   - Uses Web Search APIs to validate claims against local events.
   - Calculates a credibility score (1-10). If < 6, the issue is routed to community review.
5. **Agent 4: Resolution** (Civic Action Briefs)
   - Calculates dynamic SLA deadlines based on a severity matrix.
   - Generates a professional 150-200 word Civic Action Brief (and a local language version).
6. **Agent 5: Predictive (Async/Admin Triggered)** (Gemini 2.5 Pro)
   - Synthesizes macro-trends across the dataset using geographic DBSCAN clustering.
   - Generates predictive alerts for proactive urban planning.

---

## 🛠️ Technology Stack

* **Framework:** Next.js 16.2.9 (App Router, TypeScript, Turbopack)
* **UI/Styling:** Tailwind CSS + shadcn/ui + Framer Motion
* **Database:** Supabase (PostgreSQL 17) with PostGIS & pgvector
* **AI Orchestration:** LangGraph (`@langchain/langgraph`)
* **AI Models:** Google Gemini 2.5 Flash / Pro (via unified multi-model client)
* **Maps & Routing:** Mapbox GL JS + Google Maps Geocoding & Routes APIs
* **Deployment:** Google Cloud Run (asia-south1) via multi-stage Docker container
* **CI/CD:** GitHub Actions with Workload Identity Federation

---

## 🗄️ Database Architecture

* **`profiles`**: Extends auth.users. Tracks roles, karma scores, home locations.
* **`issues`**: Core table utilizing `geography(Point, 4326)` for spatial tracking and `vector(768)` for semantic deduplication.
* **`issue_clusters`**: Groups identical reports (deduplication) to prevent civic worker fatigue.
* **`verifications`**: Stores community voting verdicts on unverified issues.
* **`karma_events`**: Ledger of citizen engagement points.
* **`predictive_alerts`**: Stores Agent 5 geographic insights.

---

## 🚀 Getting Started

### Prerequisites
* [Bun](https://bun.sh/) installed.
* Supabase project with PostGIS and pgvector enabled.
* API Keys: Gemini, Google Maps, Mapbox.

### Quickstart
```bash
# Install dependencies
bun install

# Run the dev server
bun dev
```