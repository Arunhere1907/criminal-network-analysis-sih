import json
from datetime import datetime, timedelta
import math

class FusionScorer:
    def __init__(self, neo4j_client, ledger):
        self.neo4j_client = neo4j_client
        self.ledger = ledger
        
        # Base weights for different types of connections
        self.WEIGHTS = {
            'comm_edge': 0.25, 
            'location_edge': 0.30, 
            'financial_edge': 0.30, 
            'case_edge': 0.15
        }
        self.THRESHOLD = 0.55

    def score_pair(self, node_a, node_b, edges):
        # 1. Group edges by edge_type
        grouped_edges = {}
        for edge_record in edges:
            edge_props = edge_record.get('properties', edge_record)
            etype = edge_props.get('edge_type', 'unknown')
            if etype not in grouped_edges:
                grouped_edges[etype] = []
            
            ev_list = edge_props.get('evidence', [])
            for ev_str in ev_list:
                if isinstance(ev_str, str):
                    grouped_edges[etype].append(json.loads(ev_str))
                else:
                    grouped_edges[etype].append(ev_str)
                    
        total_score = 0.0
        breakdown = {}
        now = datetime.utcnow()
        
        # 2. For each type, compute signal
        for etype, evidences in grouped_edges.items():
            if etype not in self.WEIGHTS:
                continue
                
            weight = self.WEIGHTS[etype]
            type_score = 0.0
            
            for ev in evidences:
                value = ev.get('contribution', 0.1)
                
                # 3. Apply time decay
                timestamp_str = ev.get('timestamp')
                if timestamp_str:
                    try:
                        # Assuming ISO format or similar start
                        ts = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00')[:19])
                        days_since = (now - ts).days
                        # Decay over a 2-year window — narcotics investigations track patterns
                        # over extended periods, so events from the past year are still relevant
                        decay = max(0.3, 1.0 - (days_since / 730.0))
                        value *= decay
                    except ValueError:
                        pass # If parse fails, no decay
                        
                type_score += value
                
            # Signal = min(1, accumulated value)
            signal = min(1.0, type_score)
            weighted_signal = weight * signal
            total_score += weighted_signal
            breakdown[etype] = weighted_signal
            
        return total_score, breakdown

    def run(self):
        print("Starting risk fusion scoring...")
        # 1. Get all pairs with 2+ candidate edges
        pairs = self.neo4j_client.get_candidate_pairs()
        
        flagged = 0
        scores = []
        
        for pair in pairs:
            source = pair['source']
            target = pair['target']
            edges = pair['edges']
            
            # 2. Score each pair
            score, breakdown = self.score_pair(source, target, edges)
            scores.append({"source": source, "target": target, "score": score})
            
            # Log score computation
            self.ledger.log('score_computed', f"{source}-{target}", details=json.dumps({
                "score": score, "breakdown": breakdown
            }))
            
            # 3. Update status if above threshold
            if score >= self.THRESHOLD:
                # Update all these edges to potential_risk
                for e in edges:
                    edge_id = e.get('properties', e).get('edge_id')
                    if edge_id:
                        self.neo4j_client.update_edge_status(edge_id, 'potential_risk', risk_score=score)
                flagged += 1
                
        summary = {
            "total_pairs": len(pairs),
            "flagged": flagged,
            "scores": scores
        }
        print(f"Fusion complete: {len(pairs)} pairs analyzed, {flagged} flagged as potential risk.")
        return summary

if __name__ == '__main__':
    from backend.neo4j_client import Neo4jClient
    from backend.ledger import AuditLedger
    import os
    if not os.path.exists('data'):
        os.makedirs('data')
    client = Neo4jClient()
    ledger = AuditLedger('data/test_ledger.db')
    try:
        scorer = FusionScorer(client, ledger)
        scorer.run()
    except Exception as e:
        print(f"Error: {e}")
    finally:
        client.close()
