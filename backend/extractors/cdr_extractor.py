import csv
import json
import uuid

class CDRExtractor:
    def __init__(self, neo4j_client, ledger):
        self.neo4j_client = neo4j_client
        self.ledger = ledger

    def extract(self, csv_path='data/cdr_records.csv'):
        edges_created = 0
        try:
            with open(csv_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    # Expecting columns like record_id, caller_id, callee_id, timestamp
                    caller = row.get('caller_id')
                    callee = row.get('callee_id')
                    
                    if caller and callee:
                        edge_id = f"E-{uuid.uuid4().hex[:8].upper()}"
                        evidence = {
                            "type": "call",
                            "record_id": row.get('record_id', ''),
                            "timestamp": row.get('timestamp', ''),
                            "contribution": 0.3
                        }
                        
                        self.neo4j_client.create_edge(
                            edge_id=edge_id,
                            source=caller,
                            target=callee,
                            edge_type="comm_edge",
                            evidence=evidence,
                            status="candidate"
                        )
                        
                        self.ledger.log('edge_created', edge_id, details=json.dumps({
                            "source": caller, "target": callee, "type": "comm_edge"
                        }))
                        edges_created += 1
        except FileNotFoundError:
            print(f"Warning: {csv_path} not found.")
            
        return edges_created

if __name__ == '__main__':
    from backend.neo4j_client import Neo4jClient
    from backend.ledger import AuditLedger
    client = Neo4jClient()
    ledger = AuditLedger('data/test_ledger.db')
    try:
        extractor = CDRExtractor(client, ledger)
        count = extractor.extract()
        print(f"Created {count} CDR edges.")
    finally:
        client.close()
