import csv
import json
import uuid
from collections import defaultdict

class ColocationExtractor:
    def __init__(self, neo4j_client, ledger):
        self.neo4j_client = neo4j_client
        self.ledger = ledger

    def extract(self, csv_path='data/colocation_logs.csv'):
        edges_created = 0
        try:
            # First pass: read all logs and group by location
            location_events = defaultdict(list)
            with open(csv_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    loc = row.get('location_name')
                    if loc:
                        location_events[loc].append({
                            'person_id': row.get('person_id'),
                            'event_id': row.get('event_id', ''),
                            'timestamp_start': row.get('timestamp_start', ''),
                            'timestamp_end': row.get('timestamp_end', '')
                        })
            
            # Second pass: find overlapping windows at same location
            for loc, events in location_events.items():
                for i in range(len(events)):
                    for j in range(i + 1, len(events)):
                        e1 = events[i]
                        e2 = events[j]
                        
                        p1 = e1['person_id']
                        p2 = e2['person_id']
                        
                        if p1 == p2:
                            continue
                            
                        # Simplified overlap check assuming string sortable ISO timestamps
                        if max(e1['timestamp_start'], e2['timestamp_start']) <= min(e1['timestamp_end'], e2['timestamp_end']):
                            # Overlap found!
                            edge_id = f"E-{uuid.uuid4().hex[:8].upper()}"
                            evidence = {
                                "type": "colocation",
                                "record_id": f"{e1['event_id']}_{e2['event_id']}",
                                "timestamp": max(e1['timestamp_start'], e2['timestamp_start']),
                                "contribution": 1.0
                            }
                            
                            self.neo4j_client.create_edge(
                                edge_id=edge_id,
                                source=p1,
                                target=p2,
                                edge_type="location_edge",
                                evidence=evidence,
                                status="candidate"
                            )
                            
                            self.ledger.log('edge_created', edge_id, details=json.dumps({
                                "source": p1, "target": p2, "type": "location_edge", "location": loc
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
        extractor = ColocationExtractor(client, ledger)
        count = extractor.extract()
        print(f"Created {count} colocation edges.")
    finally:
        client.close()
