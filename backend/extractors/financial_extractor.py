import csv
import json
import uuid

class FinancialExtractor:
    def __init__(self, neo4j_client, ledger):
        self.neo4j_client = neo4j_client
        self.ledger = ledger

    def extract(self, csv_path='data/financial_transactions.csv'):
        edges_created = 0
        try:
            with open(csv_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    # Expecting sender_id, receiver_id, txn_id, timestamp
                    sender = row.get('sender_id')
                    receiver = row.get('receiver_id')
                    
                    if sender and receiver:
                        edge_id = f"E-{uuid.uuid4().hex[:8].upper()}"
                        evidence = {
                            "type": "transaction",
                            "record_id": row.get('txn_id', ''),
                            "timestamp": row.get('timestamp', ''),
                            "contribution": 1.0
                        }
                        
                        self.neo4j_client.create_edge(
                            edge_id=edge_id,
                            source=sender,
                            target=receiver,
                            edge_type="financial_edge",
                            evidence=evidence,
                            status="candidate"
                        )
                        
                        self.ledger.log('edge_created', edge_id, details=json.dumps({
                            "source": sender, "target": receiver, "type": "financial_edge"
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
        extractor = FinancialExtractor(client, ledger)
        count = extractor.extract()
        print(f"Created {count} financial edges.")
    finally:
        client.close()
