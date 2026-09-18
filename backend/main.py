from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

try:
    from .neo4j_client import Neo4jClient
    from .ledger import AuditLedger
except ImportError:
    from neo4j_client import Neo4jClient
    from ledger import AuditLedger

try:
    from .models import *
except ImportError:
    try:
        from models import *
    except ImportError:
        pass

from contextlib import asynccontextmanager
from typing import Optional, List, Dict, Any


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    app.state.neo4j = Neo4jClient()
    app.state.ledger = AuditLedger()
    yield
    # Shutdown
    app.state.neo4j.close()


app = FastAPI(
    title="Criminal Network Analysis API",
    description="Backend API for fusing multi-source intelligence and analyzing criminal networks.",
    version="1.0.0",
    lifespan=lifespan
)

# Allow CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/graph", summary="Get full or neighborhood graph")
def get_graph(node_id: Optional[str] = Query(None, description="Optional node_id for 2-hop neighborhood")):
    """
    Returns graph elements (nodes + edges) formatted for Cytoscape.js.
    If node_id is provided, returns the 2-hop neighborhood.
    """
    try:
        db: Neo4jClient = app.state.neo4j
        if node_id:
            return db.get_subgraph(node_id, depth=2)
        
        nodes_raw = db.get_all_nodes()
        edges_raw = db.get_all_edges()
        
        formatted_nodes = [
            {
                "id": n['node'].get('node_id'),
                "labels": ["Person"],
                "properties": n['node']
            }
            for n in nodes_raw
            if n.get('node', {}).get('node_id')
        ]
        
        formatted_edges = [
            {
                "id": e['edge'].get('edge_id'),
                "source": e.get('source'),
                "target": e.get('target'),
                "type": e['edge'].get('edge_type', 'comm_edge'),
                "properties": e['edge']
            }
            for e in edges_raw
            if e.get('edge', {}).get('edge_id')
        ]
        
        return {
            "nodes": formatted_nodes,
            "edges": formatted_edges
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/nodes/{node_id}", summary="Get node detail and timeline")
def get_node_detail(node_id: str):
    """
    Returns node properties and a chronological timeline of events involving this person.
    """
    try:
        db: Neo4jClient = app.state.neo4j
        node = db.get_node(node_id)
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        
        timeline = db.get_timeline(node_id)
        return {"node": node, "timeline": timeline}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/nodes/{node_id}/centrality", summary="Get centrality scores")
def get_node_centrality(node_id: str):
    """
    Computes PageRank and Betweenness Centrality for a given node.
    """
    try:
        db: Neo4jClient = app.state.neo4j
        node = db.get_node(node_id)
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        
        pagerank = db.run_pagerank(node_id)
        betweenness = db.run_betweenness(node_id)
        return {
            "node_id": node_id,
            "pagerank": float(pagerank) if isinstance(pagerank, (int, float)) else 0.0,
            "betweenness": float(betweenness) if isinstance(betweenness, (int, float)) else 0.0
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/risk-queue", summary="Get potential risk edges")
def get_risk_queue():
    """
    Returns all candidate edges that exceeded the risk fusion threshold (status='potential_risk'),
    sorted by risk_score descending. Includes source and target person names.
    """
    try:
        db: Neo4jClient = app.state.neo4j
        all_edges = db.get_all_edges()
        items = []
        
        for item in all_edges:
            edge = item['edge']
            if edge.get('status') == 'potential_risk':
                s_id = item['source']
                t_id = item['target']
                s_node = db.get_node(s_id) or {}
                t_node = db.get_node(t_id) or {}
                
                items.append({
                    "edge_id": edge.get('edge_id'),
                    "edge_type": edge.get('edge_type'),
                    "risk_score": edge.get('risk_score', 0.0),
                    "evidence": edge.get('evidence', []),
                    "status": edge.get('status'),
                    "source_id": s_id,
                    "source_names": s_node.get('names', [s_id]),
                    "source_role": s_node.get('role', 'contact'),
                    "target_id": t_id,
                    "target_names": t_node.get('names', [t_id]),
                    "target_role": t_node.get('role', 'contact'),
                })
        
        items.sort(key=lambda x: x.get('risk_score', 0.0), reverse=True)
        return {"items": items}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/risk-queue/{edge_id}/confirm", summary="Confirm a potential risk")
def confirm_risk(edge_id: str):
    """
    Promotes edge status to 'confirmed' and logs the decision into the audit ledger.
    """
    try:
        db: Neo4jClient = app.state.neo4j
        db.update_edge_status(edge_id, "confirmed")
        
        app.state.ledger.log(
            action="risk_flag_confirmed",
            ref=edge_id,
            actor="investigator",
            details='{"new_status": "confirmed"}'
        )
        return {"message": "Edge confirmed", "edge_id": edge_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Unable to confirm risk and record the audit event") from e


@app.post("/risk-queue/{edge_id}/dismiss", summary="Dismiss a potential risk")
def dismiss_risk(edge_id: str):
    """
    Sets edge status to 'dismissed' and records the investigator action in the ledger.
    """
    try:
        db: Neo4jClient = app.state.neo4j
        db.update_edge_status(edge_id, "dismissed")
        
        app.state.ledger.log(
            action="risk_flag_dismissed",
            ref=edge_id,
            actor="investigator",
            details='{"new_status": "dismissed"}'
        )
        return {"message": "Edge dismissed", "edge_id": edge_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Unable to dismiss risk and record the audit event") from e


@app.get("/communities", summary="Get community detection results")
def get_communities():
    """
    Runs Louvain community detection and returns clustered member groups.
    """
    try:
        db: Neo4jClient = app.state.neo4j
        communities = db.run_louvain()
        return {"communities": communities}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/root-cause/{event_id}", summary="Root cause traversal")
def get_root_cause(event_id: str):
    """
    Given an FIR or incident identifier, traverses backward through the network to pinpoint early triggers.
    """
    try:
        db: Neo4jClient = app.state.neo4j
        return db.get_root_cause(event_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/ledger", summary="Get paginated ledger blocks")
def get_ledger(page: int = Query(1, ge=1), per_page: int = Query(50, ge=1, le=100)):
    """
    Retrieve paginated immutable audit blocks from the hash chain.
    """
    try:
        blocks = app.state.ledger.get_all(page=page, per_page=per_page)
        
        return {"blocks": blocks, "total": app.state.ledger.count(), "page": page}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Audit ledger is unavailable") from e


@app.get("/ledger/verify", summary="Verify ledger chain integrity")
def verify_ledger():
    """
    Recomputes SHA-256 hashes across the audit chain and verifies no blocks have been modified.
    """
    try:
        result = app.state.ledger.verify_chain()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail="Audit ledger verification is unavailable") from e


@app.get("/stats", summary="Get dashboard statistics")
def get_stats():
    """
    Returns totals for nodes, edges, potential risks, confirmed flags, and detected communities.
    """
    try:
        db: Neo4jClient = app.state.neo4j
        nodes = db.get_all_nodes()
        edges = db.get_all_edges()
        
        total_nodes = len(nodes)
        total_edges = len(edges)
        potential_risks = sum(1 for e in edges if e['edge'].get('status') == 'potential_risk')
        confirmed = sum(1 for e in edges if e['edge'].get('status') == 'confirmed')
        communities = db.run_louvain()
        
        return {
            "total_nodes": total_nodes,
            "total_edges": total_edges,
            "potential_risks": potential_risks,
            "confirmed": confirmed,
            "communities": len(communities)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
