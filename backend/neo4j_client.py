import json
import os
from pathlib import Path
from typing import Dict, Any, List, Optional
import networkx as nx

try:
    from neo4j import GraphDatabase
    NEO4J_AVAILABLE = True
except ImportError:
    NEO4J_AVAILABLE = False


class Neo4jClient:
    """
    Dual-mode graph client:
    1. Connects to Neo4j with GDS when available (bolt://localhost:7687)
    2. Falls back seamlessly to an Embedded Graph Store (backed by NetworkX + data/graph_store.json)
       when Neo4j/Docker is not running locally.
    """
    def __init__(self, uri='bolt://localhost:7687', user='neo4j', password='password123', store_path=None):
        self.uri = uri
        self.user = user
        self.password = password
        self.driver = None
        self.is_embedded = True
        
        project_root = Path(__file__).parent.parent
        self.store_path = Path(store_path) if store_path else project_root / 'data' / 'graph_store.json'
        self.store_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Local in-memory graph structures
        self.nodes: Dict[str, Dict[str, Any]] = {}
        self.edges: Dict[str, Dict[str, Any]] = {}
        self._load_store()

        if NEO4J_AVAILABLE:
            try:
                # Test connectivity with a short timeout
                test_driver = GraphDatabase.driver(uri, auth=(user, password), connection_timeout=1.0)
                test_driver.verify_connectivity()
                self.driver = test_driver
                self.is_embedded = False
                print(f"[Neo4jClient] Connected to live Neo4j database at {uri}")
            except Exception:
                self.is_embedded = True
                print(f"[Neo4jClient] Neo4j not reachable at {uri}. Operating in Embedded Graph Store mode.")
        else:
            print("[Neo4jClient] neo4j driver not installed. Operating in Embedded Graph Store mode.")

    def _load_store(self):
        """Loads nodes and edges from local JSON store if present."""
        if self.store_path.exists():
            try:
                with open(self.store_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.nodes = data.get('nodes', {})
                    self.edges = data.get('edges', {})
            except Exception as e:
                print(f"[Neo4jClient] Warning loading graph store: {e}")
                self.nodes = {}
                self.edges = {}

    def _save_store(self):
        """Persists embedded nodes and edges to disk."""
        if self.is_embedded:
            try:
                with open(self.store_path, 'w', encoding='utf-8') as f:
                    json.dump({'nodes': self.nodes, 'edges': self.edges}, f, indent=2)
            except Exception as e:
                print(f"[Neo4jClient] Error saving graph store: {e}")

    def close(self):
        if self.driver:
            try:
                self.driver.close()
            except Exception:
                pass

    # -------------------------------------------------------------
    # High-level Node Management
    # -------------------------------------------------------------
    def save_node(self, node_id: str, properties: Dict[str, Any]):
        """Create or update node in both embedded store and Neo4j."""
        if self.is_embedded:
            if node_id in self.nodes:
                self.nodes[node_id].update(properties)
            else:
                props = {"node_id": node_id}
                props.update(properties)
                self.nodes[node_id] = props
            self._save_store()
        else:
            query = """
            MERGE (p:Person {node_id: $node_id})
            SET p += $properties
            """
            self.run_write(query, {"node_id": node_id, "properties": properties})

    def get_all_nodes(self) -> List[Dict[str, Any]]:
        if self.is_embedded:
            return [{"node": dict(props)} for props in self.nodes.values()]
        return self.run_query("MATCH (p:Person) RETURN properties(p) as node")

    def get_node(self, node_id: str) -> Optional[Dict[str, Any]]:
        if self.is_embedded:
            return dict(self.nodes[node_id]) if node_id in self.nodes else None
        res = self.run_query("MATCH (p:Person {node_id: $node_id}) RETURN properties(p) as node", {"node_id": node_id})
        return res[0]['node'] if res else None

    # -------------------------------------------------------------
    # High-level Edge Management
    # -------------------------------------------------------------
    def create_edge(self, edge_id: str, source: str, target: str, edge_type: str, evidence: Any, status: str = 'candidate'):
        if isinstance(evidence, dict):
            ev_list = [evidence]
        elif isinstance(evidence, list):
            ev_list = evidence
        else:
            ev_list = [evidence]

        if self.is_embedded:
            if edge_id in self.edges:
                existing_ev = self.edges[edge_id].get('evidence', [])
                existing_ev.extend(ev_list)
                self.edges[edge_id]['evidence'] = existing_ev
            else:
                self.edges[edge_id] = {
                    "edge_id": edge_id,
                    "source": source,
                    "target": target,
                    "edge_type": edge_type,
                    "status": status,
                    "risk_score": 0.0,
                    "evidence": ev_list
                }
            self._save_store()
            return self.edges[edge_id]
        else:
            evidence_str_list = [json.dumps(e) if isinstance(e, dict) else str(e) for e in ev_list]
            query = """
            MATCH (a:Person {node_id: $source}), (b:Person {node_id: $target})
            MERGE (a)-[r:CONNECTED_TO {edge_id: $edge_id}]->(b)
            ON CREATE SET r.edge_type = $edge_type, 
                          r.status = $status, 
                          r.evidence = $evidence,
                          r.risk_score = 0.0
            ON MATCH SET r.evidence = r.evidence + $evidence
            RETURN r
            """
            return self.run_query(query, {
                "source": source, "target": target, "edge_id": edge_id, 
                "edge_type": edge_type, "status": status, "evidence": evidence_str_list
            })

    def update_edge_status(self, edge_id: str, status: str, risk_score: Optional[float] = None):
        if self.is_embedded:
            if edge_id in self.edges:
                self.edges[edge_id]['status'] = status
                if risk_score is not None:
                    self.edges[edge_id]['risk_score'] = risk_score
                self._save_store()
        else:
            params = {"edge_id": edge_id, "status": status}
            query = "MATCH ()-[r:CONNECTED_TO {edge_id: $edge_id}]->() SET r.status = $status"
            if risk_score is not None:
                query += ", r.risk_score = $risk_score"
                params["risk_score"] = risk_score
            self.run_write(query, params)

    def get_all_edges(self) -> List[Dict[str, Any]]:
        if self.is_embedded:
            return [
                {
                    "edge": dict(e),
                    "source": e["source"],
                    "target": e["target"]
                }
                for e in self.edges.values()
            ]
        return self.run_query('''
            MATCH (a:Person)-[r:CONNECTED_TO]->(b:Person) 
            RETURN properties(r) as edge, a.node_id as source, b.node_id as target
        ''')

    def get_node_edges(self, node_id: str) -> List[Dict[str, Any]]:
        if self.is_embedded:
            result = []
            for e in self.edges.values():
                if e.get("source") == node_id or e.get("target") == node_id:
                    result.append({
                        "edge": dict(e),
                        "source": e["source"],
                        "target": e["target"]
                    })
            return result
        return self.run_query('''
            MATCH (a:Person {node_id: $node_id})-[r:CONNECTED_TO]-(b:Person)
            RETURN properties(r) as edge, a.node_id as source, b.node_id as target
        ''', {"node_id": node_id})

    def get_candidate_pairs(self) -> List[Dict[str, Any]]:
        """Finds all pairs of nodes that have 2 or more edges between them."""
        if self.is_embedded:
            pair_map = {}
            for e in self.edges.values():
                s, t = e["source"], e["target"]
                key = (min(s, t), max(s, t))
                if key not in pair_map:
                    pair_map[key] = []
                pair_map[key].append(dict(e))
            
            result = []
            for (s, t), edge_list in pair_map.items():
                if len(edge_list) >= 2:
                    result.append({
                        "source": s,
                        "target": t,
                        "edges": edge_list
                    })
            return result
        else:
            return self.run_query('''
                MATCH (a:Person)-[r:CONNECTED_TO]->(b:Person)
                WITH a, b, count(r) as edge_count, collect(r) as edges
                WHERE edge_count >= 2
                RETURN a.node_id as source, b.node_id as target, edges
            ''')

    # -------------------------------------------------------------
    # Entity Resolution: Merge Nodes
    # -------------------------------------------------------------
    def merge_nodes(self, keep_id: str, remove_id: str, all_names: List[str]):
        """Merges remove_id into keep_id, rewiring all edges."""
        if self.is_embedded:
            if keep_id in self.nodes:
                self.nodes[keep_id]['names'] = all_names
            # Redirect edges
            for edge in self.edges.values():
                if edge.get('source') == remove_id:
                    edge['source'] = keep_id
                if edge.get('target') == remove_id:
                    edge['target'] = keep_id
            # Remove node
            if remove_id in self.nodes:
                del self.nodes[remove_id]
            self._save_store()
        else:
            query = '''
            MATCH (keep:Person {node_id: $keep_id})
            MATCH (remove:Person {node_id: $remove_id})
            SET keep.names = $all_names
            WITH keep, remove
            OPTIONAL MATCH (n)-[r_in:CONNECTED_TO]->(remove)
            CALL {
                WITH keep, remove, n, r_in
                WITH keep, remove, n, r_in WHERE r_in IS NOT NULL
                MERGE (n)-[new_r_in:CONNECTED_TO {edge_id: r_in.edge_id}]->(keep)
                SET new_r_in += properties(r_in)
                DELETE r_in
            }
            OPTIONAL MATCH (remove)-[r_out:CONNECTED_TO]->(m)
            CALL {
                WITH keep, remove, m, r_out
                WITH keep, remove, m, r_out WHERE r_out IS NOT NULL
                MERGE (keep)-[new_r_out:CONNECTED_TO {edge_id: r_out.edge_id}]->(m)
                SET new_r_out += properties(r_out)
                DELETE r_out
            }
            DETACH DELETE remove
            '''
            self.run_write(query, {"keep_id": keep_id, "remove_id": remove_id, "all_names": all_names})

    # -------------------------------------------------------------
    # Graph Analytics (PageRank, Betweenness, Louvain)
    # -------------------------------------------------------------
    def _build_nx_graph(self, directed=False) -> nx.Graph:
        G = nx.DiGraph() if directed else nx.Graph()
        for node_id, props in self.nodes.items():
            G.add_node(node_id, **props)
        for edge_id, edge in self.edges.items():
            s = edge.get("source")
            t = edge.get("target")
            if s and t:
                G.add_edge(s, t, edge_id=edge_id, edge_type=edge.get("edge_type"), risk_score=edge.get("risk_score", 0.0))
        return G

    def run_pagerank(self, node_id: Optional[str] = None):
        if not self.is_embedded:
            try:
                try:
                    self.run_query("CALL gds.graph.project('network', 'Person', 'CONNECTED_TO') YIELD graphName")
                except Exception:
                    pass
                if node_id:
                    res = self.run_query("CALL gds.pageRank.stream('network') YIELD nodeId, score MATCH (p:Person) WHERE id(p) = nodeId RETURN p.node_id as node_id, score")
                    for r in res:
                        if r['node_id'] == node_id:
                            return r['score']
                    return 0.0
                return self.run_query("CALL gds.pageRank.stream('network') YIELD nodeId, score MATCH (p:Person) WHERE id(p) = nodeId RETURN p.node_id as node_id, score")
            except Exception:
                pass  # Fall through to NetworkX fallback

        # Embedded NetworkX calculation
        G = self._build_nx_graph(directed=True)
        if len(G) == 0:
            return 0.0 if node_id else []
        try:
            scores = nx.pagerank(G, alpha=0.85)
        except Exception:
            scores = {n: 1.0 / len(G) for n in G.nodes()}
        
        if node_id:
            return scores.get(node_id, 0.0)
        return [{"node_id": n, "score": s} for n, s in scores.items()]

    def run_betweenness(self, node_id: Optional[str] = None):
        if not self.is_embedded:
            try:
                try:
                    self.run_query("CALL gds.graph.project('network', 'Person', {CONNECTED_TO: {orientation: 'UNDIRECTED'}}) YIELD graphName")
                except Exception:
                    pass
                res = self.run_query("CALL gds.betweenness.stream('network') YIELD nodeId, score MATCH (p:Person) WHERE id(p) = nodeId RETURN p.node_id as node_id, score")
                if node_id:
                    for r in res:
                        if r['node_id'] == node_id:
                            return r['score']
                    return 0.0
                return res
            except Exception:
                pass  # Fall through to NetworkX fallback

        G = self._build_nx_graph(directed=False)
        if len(G) == 0:
            return 0.0 if node_id else []
        scores = nx.betweenness_centrality(G)
        if node_id:
            return scores.get(node_id, 0.0)
        return [{"node_id": n, "score": s} for n, s in scores.items()]

    def run_louvain(self) -> List[Dict[str, Any]]:
        if not self.is_embedded:
            try:
                try:
                    self.run_query("CALL gds.graph.project('network', 'Person', {CONNECTED_TO: {orientation: 'UNDIRECTED'}}) YIELD graphName")
                except Exception:
                    pass
                return self.run_query("CALL gds.louvain.stream('network') YIELD nodeId, communityId MATCH (p:Person) WHERE id(p) = nodeId RETURN p.node_id as node_id, communityId as community_id")
            except Exception:
                pass  # Fall through to NetworkX fallback

        G = self._build_nx_graph(directed=False)
        if len(G) == 0:
            return []
        try:
            communities = nx.community.louvain_communities(G, seed=42)
            result = []
            for idx, comm in enumerate(communities):
                members = []
                for nid in comm:
                    node_props = self.nodes.get(nid, {})
                    members.append({
                        "node_id": nid,
                        "names": node_props.get("names", [nid])
                    })
                result.append({
                    "community_id": idx + 1,
                    "members": members
                })
            return result
        except Exception:
            return [{"community_id": 1, "members": [{"node_id": nid, "names": [nid]} for nid in G.nodes()]}]

    # -------------------------------------------------------------
    # Timeline & Traversal
    # -------------------------------------------------------------
    def get_timeline(self, node_id: str) -> List[Dict[str, Any]]:
        edges = self.get_node_edges(node_id)
        events = []
        for e in edges:
            edge_props = e['edge']
            evidence_list = edge_props.get('evidence', [])
            for ev in evidence_list:
                if isinstance(ev, str):
                    try:
                        ev = json.loads(ev)
                    except Exception:
                        ev = {"type": "unknown", "raw": ev}
                
                other_person = e['target'] if e['source'] == node_id else e['source']
                events.append({
                    "event_type": ev.get('type', 'event'),
                    "timestamp": ev.get('timestamp', ''),
                    "description": f"{ev.get('type', 'link').capitalize()} link with {other_person}",
                    "related_person": other_person,
                    "record_id": ev.get('record_id', '')
                })
        return sorted(events, key=lambda x: x.get('timestamp', ''))

    def get_subgraph(self, node_id: str, depth: int = 2) -> Dict[str, Any]:
        if self.is_embedded:
            G = self._build_nx_graph(directed=False)
            if node_id not in G:
                return {"nodes": [], "edges": []}
            lengths = nx.single_source_shortest_path_length(G, node_id, cutoff=depth)
            sub_nodes = [
                {
                    "id": nid,
                    "labels": ["Person"],
                    "properties": self.nodes.get(nid, {"node_id": nid})
                }
                for nid in lengths.keys()
            ]
            sub_edges = [
                {
                    "id": e["edge_id"],
                    "source": e["source"],
                    "target": e["target"],
                    "type": e.get("edge_type", "comm_edge"),
                    "properties": e
                }
                for e in self.edges.values()
                if e["source"] in lengths and e["target"] in lengths
            ]
            return {"nodes": sub_nodes, "edges": sub_edges}
        else:
            query = f"""
            MATCH path = (start:Person {{node_id: $node_id}})-[:CONNECTED_TO*1..{depth}]-(end:Person)
            RETURN nodes(path) as nodes, relationships(path) as relationships
            """
            return self.run_query(query, {"node_id": node_id})

    def get_root_cause(self, event_id: str) -> Dict[str, Any]:
        """Finds path from an incident/case mention back to the earliest linked node."""
        if self.is_embedded:
            # Look for FIR or transaction matching event_id
            fir_path = Path(__file__).parent.parent / 'data' / 'fir_case_mentions.csv'
            seed_person = None
            if fir_path.exists():
                import csv
                with open(fir_path, 'r', encoding='utf-8') as f:
                    for row in csv.DictReader(f):
                        if row.get('fir_id') == event_id or row.get('mention_id') == event_id:
                            seed_person = row.get('person_id')
                            break
            
            if not seed_person and event_id in self.nodes:
                seed_person = event_id

            if not seed_person and self.nodes:
                seed_person = next(iter(self.nodes.keys()))

            G = self._build_nx_graph(directed=False)
            if seed_person and seed_person in G:
                # Find all neighbors up to 3 hops
                lengths = nx.single_source_shortest_path_length(G, seed_person, cutoff=3)
                earliest_node = seed_person
                earliest_ts = "9999-99-99"
                
                # Check events for earliest timestamp
                for nid in lengths:
                    events = self.get_timeline(nid)
                    if events and events[0]['timestamp'] < earliest_ts:
                        earliest_ts = events[0]['timestamp']
                        earliest_node = nid

                path_nodes = nx.shortest_path(G, seed_person, earliest_node)
                path_list = [
                    {"node_id": nid, "names": self.nodes.get(nid, {}).get("names", [nid])}
                    for nid in path_nodes
                ]
                return {
                    "event_id": event_id,
                    "path": path_list,
                    "earliest_event": {
                        "node_id": earliest_node,
                        "timestamp": earliest_ts,
                        "role": self.nodes.get(earliest_node, {}).get("role", "unknown")
                    }
                }
            return {"event_id": event_id, "path": [], "earliest_event": None}
        else:
            query = """
            MATCH path = (start_node {event_id: $event_id})-[*1..4]-(end_node)
            WITH path, end_node
            ORDER BY coalesce(end_node.timestamp, '9999-99-99') ASC
            LIMIT 1
            RETURN $event_id AS event_id,
                   [n IN nodes(path) | {node_id: coalesce(n.node_id, n.event_id), labels: labels(n)}] AS path,
                   properties(end_node) AS earliest_event
            """
            data = self.run_query(query, {"event_id": event_id})
            return data[0] if data else {"event_id": event_id, "path": [], "earliest_event": None}

    # -------------------------------------------------------------
    # Raw Query Interface
    # -------------------------------------------------------------
    def run_query(self, query: str, params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        if self.is_embedded or not self.driver:
            # Cypher emulation for common queries
            return []
        with self.driver.session() as session:
            result = session.run(query, params or {})
            return [dict(record) for record in result]

    def run_write(self, query: str, params: Optional[Dict[str, Any]] = None):
        if self.is_embedded or not self.driver:
            return
        with self.driver.session() as session:
            session.run(query, params or {})

    def create_constraints(self):
        if not self.is_embedded and self.driver:
            self.run_write("CREATE CONSTRAINT IF NOT EXISTS FOR (p:Person) REQUIRE p.node_id IS UNIQUE")
            self.run_write("CREATE INDEX IF NOT EXISTS FOR (p:Person) ON (p.phone)")
