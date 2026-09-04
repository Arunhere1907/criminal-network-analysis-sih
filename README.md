# Criminal Network Analysis System (CNA)

SIH prototype for discovering hidden relationships in a criminal network by fusing telecom, financial, co-location, and case evidence into a graph, then surfacing fused risk findings for investigator review.

The UI is an investigator-facing workstation: network exploration, risk review, community analysis, and an immutable audit ledger.

## Core capabilities

- Interactive graph exploration (Cytoscape.js)
- Multi-source evidence fusion and risk scoring
- Potential-risk queue with confirm / dismiss
- Node investigation panel (identity, timeline, centrality)
- Louvain community detection
- Root-cause traversal from case events
- Cryptographic audit ledger with chain verification

## Architecture

```text
React (Vite)  →  FastAPI  →  Graph store (Neo4j or embedded NetworkX JSON)
                              + SQLite audit ledger
```

When Neo4j is unavailable, the backend falls back to an embedded graph store (`data/graph_store.json`) so the prototype remains runnable locally without Docker.

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, Tailwind CSS, Cytoscape.js, Axios, Lucide |
| Backend | Python, FastAPI, NetworkX (embedded), optional Neo4j GDS |
| Data | Synthetic CDR / financial / co-location / FIR CSV inputs |
| Provenance | SQLite hash-chained audit ledger |

## Prerequisites

- Python 3.11+
- Node.js 18+
- Optional: Docker (for Neo4j)

## Run locally

### 1. Backend

```bash
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
```

Optional Neo4j:

```bash
docker run -d --name neo4j-criminal-network \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password123 \
  -e NEO4J_PLUGINS='["graph-data-science"]' \
  neo4j:5-community
```

Regenerate / reload synthetic data (optional; demo data is already present under `data/`):

```bash
python scripts/run_pipeline.py
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env   # optional; defaults to http://localhost:8000
npm install
npm run dev
```

Open the URL printed by Vite (typically `http://127.0.0.1:5173`).

## Demo workflow

1. **Network Explorer** — inspect the full relationship graph  
2. **Potential Risk** — open the financier–courier finding (no direct calls; co-location + financial signals)  
3. **Evidence** — review contribution breakdown and fused risk score  
4. **Confirm Relationship** — promotes the edge and writes a ledger block  
5. **Audit Ledger** — verify chain integrity  
6. **Root Cause** — from a subject panel, trace origin from a seized-drugs FIR  
7. **Centrality** — compare betweenness vs degree for intermediary roles  

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/graph` | Full graph (or 2-hop neighborhood with `node_id`) |
| `GET` | `/nodes/{node_id}` | Node detail + evidence timeline |
| `GET` | `/nodes/{node_id}/centrality` | PageRank and betweenness |
| `GET` | `/risk-queue` | Potential-risk edges by score |
| `POST` | `/risk-queue/{edge_id}/confirm` | Confirm relationship |
| `POST` | `/risk-queue/{edge_id}/dismiss` | Dismiss finding |
| `GET` | `/communities` | Louvain communities |
| `GET` | `/root-cause/{event_id}` | Backward traversal from an event/FIR |
| `GET` | `/ledger` | Paginated audit blocks |
| `GET` | `/ledger/verify` | Hash-chain integrity check |
| `GET` | `/stats` | Aggregate counts |

## Project layout

```text
backend/     FastAPI app, fusion, extractors, ledger, graph client
frontend/    React investigation UI
data/        Synthetic inputs + embedded graph store + ledger DB
scripts/     Data generation and pipeline runners
```

## Notes

- `criminal-network-prototype-prompt.md` documents the original prototype scope used to build this SIH demo.
- Neo4j credentials in the Docker example are for local demos only — change them before any shared deployment.
