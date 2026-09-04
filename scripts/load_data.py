import csv
from pathlib import Path
import sys
import os

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.neo4j_client import Neo4jClient

DATA_DIR = PROJECT_ROOT / 'data'

def load_persons():
    print("Loading data into Graph Store (Neo4j / Embedded)...")
    persons_file = DATA_DIR / 'persons.csv'
    
    if not persons_file.exists():
        print(f"Error: {persons_file} does not exist. Run generate_synthetic_data.py first.")
        return

    client = Neo4jClient()
    try:
        client.create_constraints()
        with open(persons_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            count = 0
            for row in reader:
                prior_cases = row['prior_cases'].split(';') if row.get('prior_cases') else []
                names = [row['name']]
                addresses = [row['address']] if row.get('address') else []
                
                properties = {
                    "names": names,
                    "phone": row.get('phone', ''),
                    "addresses": addresses,
                    "city": row.get('city', ''),
                    "bail_status": row.get('bail_status', 'none'),
                    "prior_cases": prior_cases,
                    "role": row.get('role', 'contact'),
                    "network_score": None
                }
                client.save_node(row['person_id'], properties)
                count += 1
                
        print(f"Successfully loaded {count} persons into Graph Store.")
    finally:
        client.close()

def main():
    load_persons()

if __name__ == '__main__':
    main()
