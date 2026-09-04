import sqlite3
import hashlib
import json
import os
from datetime import datetime
from typing import Optional, Dict, Any

class AuditLedger:
    def __init__(self, db_path='data/ledger.db'):
        self.db_path = db_path
        os.makedirs(os.path.dirname(os.path.abspath(self.db_path)), exist_ok=True)
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS ledger (
                    block_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    action TEXT,
                    ref TEXT,
                    actor TEXT,
                    timestamp TEXT,
                    details TEXT,
                    prev_hash TEXT,
                    hash TEXT
                )
            ''')
            conn.commit()

    def _compute_hash(self, block_id: int, action: str, ref: str, actor: str, timestamp: str, details: Optional[str], prev_hash: str) -> str:
        # SHA-256 of all fields concatenated as JSON string
        data = json.dumps({
            "block_id": block_id,
            "action": action,
            "ref": ref,
            "actor": actor,
            "timestamp": timestamp,
            "details": details,
            "prev_hash": prev_hash
        }, sort_keys=True)
        return hashlib.sha256(data.encode('utf-8')).hexdigest()

    def _get_last_block(self) -> Optional[Dict[str, Any]]:
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            cur.execute("SELECT * FROM ledger ORDER BY block_id DESC LIMIT 1")
            row = cur.fetchone()
            return dict(row) if row else None

    def _get_last_hash(self) -> str:
        last_block = self._get_last_block()
        return last_block['hash'] if last_block else '0' * 64

    def log(self, action: str, ref: str, actor: str = 'system', details: Optional[str] = None) -> dict:
        timestamp = datetime.utcnow().isoformat()
        prev_hash = self._get_last_hash()
        
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            
            cur.execute("SELECT IFNULL(MAX(block_id), 0) + 1 FROM ledger")
            block_id = cur.fetchone()[0]
            
            details_str = json.dumps(details) if details else None
            block_hash = self._compute_hash(block_id, action, ref, actor, timestamp, details_str, prev_hash)
            
            cur.execute('''
                INSERT INTO ledger (block_id, action, ref, actor, timestamp, details, prev_hash, hash)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (block_id, action, ref, actor, timestamp, details_str, prev_hash, block_hash))
            conn.commit()
            
            cur.execute("SELECT * FROM ledger WHERE block_id = ?", (block_id,))
            return dict(cur.fetchone())

    def get_all(self, page: int = 1, per_page: int = 50):
        offset = (page - 1) * per_page
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            cur.execute("SELECT * FROM ledger ORDER BY block_id ASC LIMIT ? OFFSET ?", (per_page, offset))
            return [dict(row) for row in cur.fetchall()]

    def verify_chain(self) -> Dict[str, Any]:
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            cur.execute("SELECT * FROM ledger ORDER BY block_id ASC")
            blocks = cur.fetchall()
            
            prev_hash = '0' * 64
            for block in blocks:
                if block['prev_hash'] != prev_hash:
                    return {"valid": False, "blocks_checked": block['block_id'] - 1, "first_invalid": block['block_id']}
                
                computed_hash = self._compute_hash(
                    block['block_id'], block['action'], block['ref'], 
                    block['actor'], block['timestamp'], block['details'], block['prev_hash']
                )
                if block['hash'] != computed_hash:
                    return {"valid": False, "blocks_checked": block['block_id'] - 1, "first_invalid": block['block_id']}
                
                prev_hash = block['hash']
                
            return {"valid": True, "blocks_checked": len(blocks), "first_invalid": None}

    def get_block(self, block_id: int):
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            cur.execute("SELECT * FROM ledger WHERE block_id = ?", (block_id,))
            row = cur.fetchone()
            return dict(row) if row else None

if __name__ == '__main__':
    # Test ledger
    import os
    ledger = AuditLedger('data/test_ledger.db')
    ledger.log('node_created', 'P-0001', 'system', '{"name": "John Doe"}')
    ledger.log('edge_created', 'E-0001', 'system', '{"source": "P-0001", "target": "P-0002"}')
    print("Chain verification:", ledger.verify_chain())
