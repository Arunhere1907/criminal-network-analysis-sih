"""Import the legacy SQLite audit ledger into PostgreSQL without rewriting its chain."""

import argparse
import os
import sqlite3
import sys
from pathlib import Path

import psycopg

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from backend.ledger import AuditLedger


FIELDS = ("block_id", "action", "ref", "actor", "timestamp", "details", "prev_hash", "hash")


def read_sqlite_blocks(path: Path):
    if not path.exists():
        raise RuntimeError(f"SQLite ledger not found: {path}")
    with sqlite3.connect(path) as conn:
        conn.row_factory = sqlite3.Row
        columns = {
            row[1] for row in conn.execute("PRAGMA table_info(ledger)").fetchall()
        }
        missing = set(FIELDS) - columns
        if missing:
            raise RuntimeError(f"SQLite ledger schema is missing columns: {', '.join(sorted(missing))}")
        return [dict(row) for row in conn.execute("SELECT * FROM ledger ORDER BY block_id ASC")]


def validate_chain(ledger: AuditLedger, blocks):
    previous = "0" * 64
    for expected_id, block in enumerate(blocks, start=1):
        if block["block_id"] != expected_id or block["prev_hash"] != previous:
            raise RuntimeError(f"SQLite ledger chain mismatch at block {block['block_id']}")
        computed = ledger._compute_hash(*(block[field] for field in FIELDS[:-1]))
        if block["hash"] != computed:
            raise RuntimeError(f"SQLite ledger hash mismatch at block {block['block_id']}")
        previous = block["hash"]


def migrate(source: Path):
    blocks = read_sqlite_blocks(source)
    ledger = AuditLedger()
    validate_chain(ledger, blocks)

    with psycopg.connect(ledger.database_url) as conn:
        conn.execute("SELECT pg_advisory_xact_lock(hashtext('audit_ledger_append'))")
        for block in blocks:
            existing = conn.execute(
                "SELECT * FROM audit_ledger WHERE block_id = %s", (block["block_id"],)
            ).fetchone()
            if existing is not None:
                if tuple(existing[field] for field in FIELDS) != tuple(block[field] for field in FIELDS):
                    raise RuntimeError(f"PostgreSQL block {block['block_id']} does not match SQLite; no import performed")
                continue
            conn.execute(
                """
                INSERT INTO audit_ledger
                    (block_id, action, ref, actor, timestamp, details, prev_hash, hash)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                tuple(block[field] for field in FIELDS),
            )
        if blocks:
            conn.execute(
                "SELECT setval(pg_get_serial_sequence('audit_ledger', 'block_id'), %s, true)",
                (blocks[-1]["block_id"],),
            )
    print(f"Validated and imported {len(blocks)} ledger blocks from {source}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "source",
        nargs="?",
        type=Path,
        default=PROJECT_ROOT / "data" / "ledger.db",
        help="Path to the legacy SQLite ledger",
    )
    args = parser.parse_args()
    migrate(args.source)