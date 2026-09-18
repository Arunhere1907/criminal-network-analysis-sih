import hashlib
import json
import os
from datetime import datetime
from typing import Any, Dict, Optional

import psycopg
from psycopg.rows import dict_row


class AuditLedger:
    """PostgreSQL-backed, hash-chained audit ledger."""

    def __init__(self, db_path=None):
        del db_path  # Preserve compatibility with existing callers.
        self.database_url = os.getenv("DATABASE_URL")
        if not self.database_url:
            raise RuntimeError("DATABASE_URL environment variable is required for the audit ledger")
        self._init_db()

    def _connect(self):
        return psycopg.connect(self.database_url, row_factory=dict_row)

    def _init_db(self):
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS audit_ledger (
                    block_id BIGSERIAL PRIMARY KEY,
                    action TEXT NOT NULL,
                    ref TEXT NOT NULL,
                    actor TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    details TEXT,
                    prev_hash CHAR(64) NOT NULL,
                    hash CHAR(64) NOT NULL UNIQUE
                )
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS audit_ledger_timestamp_idx "
                "ON audit_ledger (timestamp, block_id)"
            )

    def _compute_hash(
        self,
        block_id: int,
        action: str,
        ref: str,
        actor: str,
        timestamp: str,
        details: Optional[str],
        prev_hash: str,
    ) -> str:
        data = json.dumps(
            {
                "block_id": block_id,
                "action": action,
                "ref": ref,
                "actor": actor,
                "timestamp": timestamp,
                "details": details,
                "prev_hash": prev_hash,
            },
            sort_keys=True,
        )
        return hashlib.sha256(data.encode("utf-8")).hexdigest()

    def _get_last_block(self, conn) -> Optional[Dict[str, Any]]:
        return conn.execute(
            "SELECT * FROM audit_ledger ORDER BY block_id DESC LIMIT 1"
        ).fetchone()

    def _get_last_hash(self) -> str:
        with self._connect() as conn:
            last_block = self._get_last_block(conn)
            return last_block["hash"] if last_block else "0" * 64

    def log(
        self,
        action: str,
        ref: str,
        actor: str = "system",
        details: Optional[str] = None,
    ) -> dict:
        timestamp = datetime.utcnow().isoformat()
        details_str = json.dumps(details) if details else None

        with self._connect() as conn:
            # Serialize appends so block IDs and prev_hash cannot fork concurrently.
            conn.execute("SELECT pg_advisory_xact_lock(hashtext('audit_ledger_append'))")
            last_block = self._get_last_block(conn)
            prev_hash = last_block["hash"] if last_block else "0" * 64
            block_id = (last_block["block_id"] + 1) if last_block else 1
            block_hash = self._compute_hash(
                block_id, action, ref, actor, timestamp, details_str, prev_hash
            )
            conn.execute(
                """
                INSERT INTO audit_ledger
                    (block_id, action, ref, actor, timestamp, details, prev_hash, hash)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (block_id, action, ref, actor, timestamp, details_str, prev_hash, block_hash),
            )
            conn.execute(
                "SELECT setval(pg_get_serial_sequence('audit_ledger', 'block_id'), %s, true)",
                (block_id,),
            )
            return conn.execute(
                "SELECT * FROM audit_ledger WHERE block_id = %s", (block_id,)
            ).fetchone()

    def get_all(self, page: int = 1, per_page: int = 50):
        offset = (page - 1) * per_page
        with self._connect() as conn:
            return conn.execute(
                """
                SELECT * FROM audit_ledger
                ORDER BY block_id ASC
                LIMIT %s OFFSET %s
                """,
                (per_page, offset),
            ).fetchall()

    def count(self) -> int:
        with self._connect() as conn:
            return conn.execute("SELECT COUNT(*) AS count FROM audit_ledger").fetchone()["count"]

    def verify_chain(self) -> Dict[str, Any]:
        with self._connect() as conn:
            blocks = conn.execute(
                "SELECT * FROM audit_ledger ORDER BY block_id ASC"
            ).fetchall()

        prev_hash = "0" * 64
        expected_block_id = 1
        for block in blocks:
            if block["block_id"] != expected_block_id or block["prev_hash"] != prev_hash:
                return {
                    "valid": False,
                    "blocks_checked": expected_block_id - 1,
                    "first_invalid": block["block_id"],
                }
            computed_hash = self._compute_hash(
                block["block_id"],
                block["action"],
                block["ref"],
                block["actor"],
                block["timestamp"],
                block["details"],
                block["prev_hash"],
            )
            if block["hash"] != computed_hash:
                return {
                    "valid": False,
                    "blocks_checked": expected_block_id - 1,
                    "first_invalid": block["block_id"],
                }
            prev_hash = block["hash"]
            expected_block_id += 1

        return {"valid": True, "blocks_checked": len(blocks), "first_invalid": None}

    def get_block(self, block_id: int):
        with self._connect() as conn:
            return conn.execute(
                "SELECT * FROM audit_ledger WHERE block_id = %s", (block_id,)
            ).fetchone()


if __name__ == "__main__":
    ledger = AuditLedger()
    ledger.log("node_created", "P-0001", "system", '{"name": "John Doe"}')
    ledger.log("edge_created", "E-0001", "system", '{"source": "P-0001", "target": "P-0002"}')
    print("Chain verification:", ledger.verify_chain())