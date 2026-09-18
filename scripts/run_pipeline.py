"""
Master pipeline script that runs the full Criminal Network Analysis pipeline.
Run this after Neo4j is started and data CSVs are generated.
"""
import sys
import os

# Add project root to path so backend modules can be imported
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_ROOT)


def main():
    print("=" * 60)
    print("Criminal Network Analysis Pipeline")
    print("=" * 60)

    # Step 1: Generate synthetic data
    print("\n[1/6] Generating synthetic data...")
    from scripts.generate_synthetic_data import main as generate_data
    generate_data()

    # Step 2: Load data into Neo4j
    print("\n[2/6] Loading data into Neo4j...")
    from scripts.load_data import main as load_data
    load_data()

    # Step 3: Entity Resolution
    print("\n[3/6] Running entity resolution...")
    from backend.neo4j_client import Neo4jClient
    from backend.ledger import AuditLedger

    client = Neo4jClient()
    ledger = AuditLedger()

    try:
        from backend.entity_resolution import EntityResolver
        resolver = EntityResolver(client, ledger)
        result = resolver.resolve()
        print(f"   Entity resolution: {result}")

        # Step 4: Run all extractors
        print("\n[4/6] Running connection-discovery extractors...")

        from backend.extractors.cdr_extractor import CDRExtractor
        cdr = CDRExtractor(client, ledger)
        count = cdr.extract(os.path.join(PROJECT_ROOT, 'data', 'cdr_records.csv'))
        print(f"   CDR extractor: {count} edges created")

        from backend.extractors.financial_extractor import FinancialExtractor
        fin = FinancialExtractor(client, ledger)
        count = fin.extract(os.path.join(PROJECT_ROOT, 'data', 'financial_transactions.csv'))
        print(f"   Financial extractor: {count} edges created")

        from backend.extractors.colocation_extractor import ColocationExtractor
        coloc = ColocationExtractor(client, ledger)
        count = coloc.extract(os.path.join(PROJECT_ROOT, 'data', 'colocation_logs.csv'))
        print(f"   Co-location extractor: {count} edges created")

        from backend.extractors.case_extractor import CaseExtractor
        case = CaseExtractor(client, ledger)
        count = case.extract(os.path.join(PROJECT_ROOT, 'data', 'fir_case_mentions.csv'))
        print(f"   Case extractor: {count} edges created")

        # Step 5: Run fusion scorer
        print("\n[5/6] Running risk fusion scoring...")
        from backend.fusion import FusionScorer
        scorer = FusionScorer(client, ledger)
        result = scorer.run()
        print(f"   Fusion: {result['total_pairs']} pairs scored, {result['flagged']} flagged")

        # Step 6: Verify ledger
        print("\n[6/6] Verifying audit ledger chain...")
        verification = ledger.verify_chain()
        print(f"   Ledger: {verification}")

    finally:
        client.close()

    print("\n" + "=" * 60)
    print("Pipeline completed successfully!")
    print("=" * 60)
    print("\nNext steps:")
    print("  1. Start backend:  uvicorn backend.main:app --reload --port 8000")
    print("  2. Start frontend: cd frontend && npm run dev")
    print("  3. Open http://localhost:5173 in your browser")


if __name__ == '__main__':
    main()
