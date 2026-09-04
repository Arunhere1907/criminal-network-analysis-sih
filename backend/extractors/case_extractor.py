import csv
import json
import uuid
from collections import defaultdict

class CaseExtractor:
    def __init__(self, neo4j_client, ledger):
        self.neo4j_client = neo4j_client
        self.ledger = ledger

    def extract(self, csv_path='data/fir_case_mentions.csv'):
        edges_created = 0
        try:
            # Group by fir_id
            cases = defaultdict(list)
            with open(csv_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    fir = row.get('fir_id')
                    if fir:
                        cases[fir].append({
                            'person_id': row.get('person_id'),
                            'date': row.get('fir_date', '')
                        })
            
            # Create edges for pairs in same case
            for fir, mentions in cases.items():
                for i in range(len(mentions)):
                    for j in range(i + 1, len(mentions)):
                        m1 = mentions[i]
                        m2 = mentions[j]
                        
                        p1 = m1['person_id']
                        p2 = m2['person_id']
                        
                        if p1 == p2:
                            continue
                            
                        edge_id = f"E-{uuid.uuid4().hex[:8].upper()}"
                        evidence = {
                            "type": "case_mention",
                            "record_id": fir,
                            "timestamp": m1['date'],
                            "contribution": 0.25
                        }
                        
                        self.neo4j_client.create_edge(
                            edge_id=edge_id,
                            source=p1,
                            target=p2,
                            edge_type="case_edge",
                            evidence=evidence,
                            status="candidate"
                        )
                        
                        self.ledger.log('edge_created', edge_id, details=json.dumps({
                            "source": p1, "target": p2, "type": "case_edge", "fir_id": fir
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
        extractor = CaseExtractor(client, ledger)
        count = extractor.extract()
        print(f"Created {count} case edges.")
    finally:
        client.close()
