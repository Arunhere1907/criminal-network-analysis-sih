from rapidfuzz import fuzz
import json

class EntityResolver:
    def __init__(self, neo4j_client, ledger):
        self.neo4j_client = neo4j_client
        self.ledger = ledger

    def resolve(self):
        print("Starting entity resolution...")
        nodes = self.neo4j_client.get_all_nodes()
        nodes_list = [n['node'] for n in nodes]
        
        auto_merged = 0
        queued = 0
        total_compared = 0
        
        # Simple O(N^2) comparison for prototype
        processed = set()
        
        for i in range(len(nodes_list)):
            for j in range(i + 1, len(nodes_list)):
                node1 = nodes_list[i]
                node2 = nodes_list[j]
                
                if node1['node_id'] in processed or node2['node_id'] in processed:
                    continue
                    
                total_compared += 1
                
                # Compare names using rapidfuzz
                # Take best match among all aliases
                best_name_score = 0
                for n1 in node1.get('names', []):
                    for n2 in node2.get('names', []):
                        score = fuzz.token_sort_ratio(n1, n2)
                        best_name_score = max(best_name_score, score)
                
                # Check phone match
                phones_match = (node1.get('phone') and node2.get('phone') and node1['phone'] == node2['phone'])
                
                # Combined score
                if phones_match:
                    final_score = max(90, best_name_score)
                else:
                    final_score = best_name_score
                    
                if final_score >= 90:
                    self._merge_nodes(node1['node_id'], node2['node_id'], node1, node2)
                    auto_merged += 1
                    processed.add(node2['node_id'])
                    print(f"Auto-merged {node1['node_id']} and {node2['node_id']} (Score: {final_score})")
                elif final_score >= 75:
                    self.ledger.log('merge_queued', f"{node1['node_id']}-{node2['node_id']}", details=json.dumps({
                        "node1": node1['node_id'], "node2": node2['node_id'], "score": final_score
                    }))
                    queued += 1
                    print(f"Queued for review: {node1['node_id']} and {node2['node_id']} (Score: {final_score})")
                    
        summary = {
            "auto_merged": auto_merged,
            "queued": queued,
            "total_compared": total_compared
        }
        print(f"Resolution complete: {summary}")
        return summary

    def _merge_nodes(self, keep_id, remove_id, node_keep, node_remove):
        # Combine names
        all_names = list(set(node_keep.get('names', []) + node_remove.get('names', [])))
        self.neo4j_client.merge_nodes(keep_id, remove_id, all_names)
        
        self.ledger.log('merge_confirmed', f"{keep_id}-{remove_id}", details=json.dumps({
            "kept": keep_id, "removed": remove_id
        }))

if __name__ == '__main__':
    # For standalone testing
    from backend.neo4j_client import Neo4jClient
    from backend.ledger import AuditLedger
    import os
    if not os.path.exists('data'):
        os.makedirs('data')
    client = Neo4jClient()
    ledger = AuditLedger('data/test_ledger.db')
    try:
        resolver = EntityResolver(client, ledger)
        resolver.resolve()
    except Exception as e:
        print(f"Error: {e}")
    finally:
        client.close()
