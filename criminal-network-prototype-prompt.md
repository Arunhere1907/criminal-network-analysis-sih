# Build Prompt: Criminal Network Analysis — Prototype (Narcotics Trafficking Ring domain)

Paste this whole file into your IDE agent (Claude Code, Cursor, etc.) as the initial instruction. It scopes your full SIH architecture down to a single demo-able domain that can be built in a hackathon window.

---

## 0. Why this domain

Picked **narcotics trafficking ring** over financial fraud / human trafficking because it's the only domain that naturally exercises all four connection-discovery extractors from the architecture without forcing it:
- CDR (peddler ↔ supplier calls)
- Financial (small frequent cash-like transactions, not one big wire)
- Co-location (physical handoffs at markets/warehouses)
- Case linkage (multiple FIRs naming overlapping people)

It also gives a clean "kingpin" narrative for the SNA centrality demo — a mid-level courier with high degree but low centrality vs. a low-visibility financier with high betweenness centrality. That contrast is a strong 2-minute evaluator story.

If you'd rather do financial fraud or a gang-violence ring instead, the architecture underneath is identical — only the synthetic dataset and node/edge flavor text in Section 3 would change.

---

## 1. Scope for this build (read before generating anything)

This is a **36-hour hackathon prototype**, not the production architecture in `criminal-network-architecture.md`. Cut ruthlessly:

**Build:**
- Synthetic dataset generator (no real data, no OCR, no live NER on scanned docs)
- 4 connection-discovery extractors running on structured synthetic data (skip live NER — pre-tag entities in the synthetic FIR text instead of training/running a real model)
- Entity resolution: simple fuzzy-match + human-confirm queue (rapidfuzz), not embedding-based cross-script matching
- Risk fusion: **weighted sum**, not full Bayesian log-odds — the doc's own Section 2.5 says hand-set constants are honest for a demo; log-odds is future work, not what you explain live under time pressure
- Graph store: Neo4j (free Desktop or AuraDB Free tier)
- Hash-chained audit ledger: real SHA-256 chaining, minimal implementation (~50 lines)
- Dashboard: graph explorer + Potential Risk review queue + one node detail panel + timeline for one person
- One canned root-cause traversal query, one centrality query, one community-detection query

**Do NOT build (mention as future work if asked, don't attempt):**
- Real OCR / scanned document pipeline
- Multilingual/cross-script entity resolution
- Live LLM natural-language-to-Cypher layer (fake it with 3-4 hardcoded example queries in the search box if a demo needs it)
- Bayesian log-odds calibration
- Any auth/RBAC system beyond a single hardcoded "investigator" role
- Message queue (Redis Streams/RabbitMQ) — direct function calls are fine at this scale

---

## 2. Tech stack (fixed — don't deviate, optimized for setup speed)

- **Backend:** Python 3.11 + FastAPI
- **Graph DB:** Neo4j (Community Edition via Docker, or AuraDB Free) + `neo4j` Python driver
- **Graph algorithms:** Neo4j GDS library (PageRank, betweenness centrality, Louvain) — comes free with Neo4j Desktop/Docker image `neo4j:5-community` if you add the GDS plugin, or use AuraDB Free which has GDS built in
- **Entity resolution:** `rapidfuzz`
- **Ledger:** plain Python, `hashlib.sha256`, stored as rows in a small SQLite table (don't overthink storage — the guarantee is the hash chain, not the DB)
- **Frontend:** React (Vite) + Cytoscape.js for the graph view, plain CSS (no need for a design system for a hackathon demo)
- **Synthetic data:** a Python script using `Faker` for Indian names/phone numbers, generating CSVs that mimic CDR exports, bank transaction logs, and FIR text files

Do not introduce Kafka, Redis, Docker Compose with 6 services, Kubernetes, or anything else that eats setup time. Single Docker container for Neo4j, everything else runs as local processes.

---

## 3. Synthetic dataset — generate this first, before any backend code

Build `scripts/generate_synthetic_data.py`. It should produce a self-consistent scenario, not random noise, because the demo narrative depends on the data actually containing the pattern you're about to detect.

**Scenario to encode:**
- ~40 person nodes: a mix of known offenders (bail status, prior FIRs), unknowns, and 2 "clean" people who turn out to be connected once fusion runs
- 1 known peddler ring operating across 3 city locations
- A financier who has **no direct calls** to the peddlers (deliberately — this is the "silent link" your Section 4 differentiator is built to catch) but shares:
  - 2 co-location events with a mid-level courier (same market, overlapping time windows, 3 weeks apart)
  - 1 financial transaction to an account later linked to a seized-drugs FIR
  - No FIR mentions the financier directly — that's the point, the system should surface them as a Potential Risk before an investigator would think to check
- Generate CSVs: `cdr_records.csv`, `financial_transactions.csv`, `colocation_logs.csv`, `fir_case_mentions.csv` (pre-tagged with person IDs — skip NER, treat this as if NER already ran)
- Include 3-4 duplicate-identity cases on purpose (e.g. "Rajesh Kumar" in one CSV, "R. Kumar" in another, same phone number) so the entity resolution step has something real to do and isn't a no-op

Output row counts: keep it demo-sized. ~150 CDR rows, ~60 transactions, ~40 co-location events, ~25 FIR mentions. Enough for the graph to look non-trivial in Cytoscape without being unreadable.

---

## 4. Data model — use exactly this (matches the architecture doc, trimmed)

**Person node:**
```json
{
  "node_id": "P-0001",
  "names": ["Rajesh Kumar", "R. Kumar"],
  "known_addresses": [...],
  "bail_status": "on_bail | none | absconding",
  "prior_cases": ["FIR-2026-0114"],
  "network_score": null
}
```

**Edge:**
```json
{
  "edge_id": "E-0001",
  "source": "P-0001",
  "target": "P-0002",
  "edge_type": "comm_edge | financial_edge | location_edge | case_edge",
  "risk_score": 0.0,
  "evidence": [
    {"type": "call", "record_id": "CDR-004", "timestamp": "...", "contribution": 0.3}
  ],
  "status": "confirmed | potential_risk | dismissed"
}
```

**Ledger block:**
```json
{
  "block_id": 1,
  "action": "node_created | edge_created | merge_confirmed | risk_flag_confirmed | risk_flag_dismissed",
  "ref": "P-0001",
  "actor": "system | investigator",
  "timestamp": "...",
  "prev_hash": "...",
  "hash": "..."
}
```

---

## 5. Risk scoring (simplified for demo)

Use a plain weighted sum, explainable in one sentence to an evaluator:

```
risk_score(A, B) = w1 * comm_signal + w2 * proximity_signal + w3 * financial_signal + w4 * case_signal
```

- Default weights: `w1=0.25, w2=0.3, w3=0.3, w4=0.15` (proximity and financial weighted slightly higher — this is a narcotics scenario, physical handoffs and cash both matter more than a single phone call)
- Each signal is `min(1, count_of_events * per_event_value)`, decayed by a simple linear time-decay: `value *= max(0.3, 1 - days_since_event/365)`
- Threshold for "Potential Risk" flag: `risk_score >= 0.55`
- Log every scored pair, not just ones that cross threshold — makes the review queue and the "why wasn't this flagged" question answerable

---

## 6. Build order (follow this sequence — each step should run/demo before moving to the next)

1. **Data generator** (Section 3) — run it, sanity-check the CSVs by eye
2. **Neo4j schema + loader script** — load raw entities as nodes, no edges yet
3. **Entity resolution pass** — run rapidfuzz over the loaded nodes, auto-merge above a high threshold (e.g. 90), queue borderline (75-90) for a manual confirm step, leave below 75 alone. Log every merge to the ledger.
4. **Four extractors** — one script per extractor (CDR, financial, co-location, case), each reads its CSV, writes candidate edges to Neo4j with `status: candidate`
5. **Fusion scorer** — for every pair of nodes with 2+ candidate edges between them, compute the weighted risk score, write it back onto the edge, set `status: potential_risk` if over threshold
6. **Ledger** — wire hash-chaining into steps 3-5 so every mutation is already chained by the time you build the dashboard (retrofitting the ledger later is more work, not less)
7. **FastAPI layer** — endpoints below
8. **React dashboard** — graph view first (it's the most visually convincing part for evaluators), then the Potential Risk queue, then node detail/timeline

---

## 7. API endpoints (FastAPI)

```
GET  /graph                       -> full node+edge set for Cytoscape (or /graph?node_id=X for a subgraph)
GET  /nodes/{node_id}             -> node detail + timeline of events involving them
GET  /nodes/{node_id}/centrality  -> PageRank + betweenness score, computed via Neo4j GDS
GET  /risk-queue                  -> all edges with status=potential_risk, sorted by score desc
POST /risk-queue/{edge_id}/confirm    -> promotes edge to status=confirmed, writes ledger block
POST /risk-queue/{edge_id}/dismiss    -> sets status=dismissed, writes ledger block
GET  /communities                 -> Louvain community detection result, grouped node lists
GET  /root-cause/{event_id}       -> backward traversal from an FIR/incident node to earliest linked trigger
GET  /ledger                      -> paginated ledger, with a /ledger/verify endpoint that walks the chain and confirms no hash is broken (good live-demo moment — "watch me try to tamper with this record and the verify check fails")
```

---

## 8. Frontend pages (React + Cytoscape.js)

1. **Graph Explorer** — full network, color-coded by node type, edge thickness mapped to risk_score, click a node to open detail panel
2. **Potential Risk Queue** — list/table of flagged pairs, each showing the evidence breakdown (which signals fired, individual contributions) with Confirm/Dismiss buttons
3. **Node Detail Panel** — timeline of events for one person (calls, transactions, co-locations, case mentions) plus their centrality scores
4. **Ledger Viewer** (optional if time allows) — scrolling list of blocks + a "Verify Chain" button that visibly runs the hash check

Don't build a login screen, don't build settings, don't build a landing page. Evaluators judge the graph view and the risk queue — put your remaining hours there.

---

## 9. Demo script to build toward (have the agent keep this in mind while structuring the code, not just the UI)

1. Show the full graph — looks like a normal social/comms network
2. Open the Potential Risk queue — highlight the financier-courier pair with **zero direct calls** but a flagged risk score
3. Click into that pair's evidence breakdown — show the two co-location events and the one transaction that individually mean nothing, but fused, crossed the threshold
4. Confirm the flag — show it becomes a real edge in the graph, and a new ledger block appears
5. Run root-cause traversal from the seized-drugs FIR — walk backward to show the earliest connected event
6. Run centrality — show the financier scores high on betweenness despite low degree, i.e., the "real kingpin isn't the guy with the most arrests" story
7. Open the ledger, verify the chain, then (for effect) manually edit one row in the DB and re-run verify to show it fails

---

## 10. Instructions to the coding agent

- Scaffold the repo with this structure:
```
/data/                  synthetic CSVs land here
/scripts/generate_synthetic_data.py
/backend/
  main.py                FastAPI app
  models.py
  neo4j_client.py
  extractors/            one file per extractor
  fusion.py
  entity_resolution.py
  ledger.py
/frontend/
  (Vite React app)
README.md                setup + run instructions, and the demo script from Section 9
```
- Get Section 3 (data generator) and Section 6 steps 2-6 fully working and testable from the command line **before** touching FastAPI or React — a working graph in Neo4j Browser is the checkpoint, not a pretty UI
- Write a `README.md` that includes exact `docker run` command for Neo4j, `pip install` / `npm install` steps, and the order to run scripts in, so teammates can get this running on their own machines without asking questions
- Keep functions short with clear names; add a short comment above any non-obvious piece of logic (especially the fusion scoring and the hash chaining) explaining *why*, not just what
- Prioritize: working backend pipeline > graph visualization > risk queue UI > ledger UI > NL query stretch goal, in that order, if time runs out
