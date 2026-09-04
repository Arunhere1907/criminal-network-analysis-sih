import React, { useEffect, useState } from 'react';
import { fetchLedger, verifyLedger } from '../api';

export default function LedgerViewer() {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [verifyStatus, setVerifyStatus] = useState(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    loadBlocks(page);
  }, [page]);

  const loadBlocks = (p) => {
    setLoading(true);
    fetchLedger(p).then(res => {
      // Assuming API returns { data: [...] } or array directly
      setBlocks(res.data.blocks || res.data || []);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  };

  const handleVerify = () => {
    setVerifying(true);
    setVerifyStatus(null);
    verifyLedger().then(res => {
      // Expecting { valid: true/false }
      setVerifyStatus(res.data.valid ? 'success' : 'error');
    }).catch(err => {
      console.error(err);
      setVerifyStatus('error');
    }).finally(() => {
      setVerifying(false);
    });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="view-header">
        <h2>Audit Ledger <span className="count-badge">{blocks.length}</span></h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {verifyStatus === 'success' && <span className="verification-result verify-success">✅ Valid Chain</span>}
          {verifyStatus === 'error' && <span className="verification-result verify-error">❌ Invalid Chain!</span>}
          <button 
            className="action-btn btn-verify" 
            onClick={handleVerify}
            disabled={verifying}
          >
            {verifying ? 'Verifying...' : 'Verify Chain'}
          </button>
        </div>
      </div>
      
      <div className="table-container">
        {loading ? <p>Loading ledger...</p> : (
          <>
            <table>
              <thead>
                <tr>
                  <th>Block ID</th>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Reference</th>
                  <th>Hash</th>
                </tr>
              </thead>
              <tbody>
                {blocks.map((block, i) => (
                  <tr key={block.block_id || i}>
                    <td>{block.block_id}</td>
                    <td>{block.timestamp}</td>
                    <td><span className="badge">{block.action}</span></td>
                    <td>{block.actor}</td>
                    <td>{block.ref}</td>
                    <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                      {block.hash ? `${block.hash.substring(0, 16)}...` : 'N/A'}
                    </td>
                  </tr>
                ))}
                {blocks.length === 0 && (
                  <tr><td colSpan="6" style={{ textAlign: 'center' }}>Ledger is empty.</td></tr>
                )}
              </tbody>
            </table>
            
            <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))} 
                disabled={page === 1}
                style={{ padding: '8px 16px' }}
              >
                Previous
              </button>
              <span style={{ padding: '8px' }}>Page {page}</span>
              <button 
                onClick={() => setPage(p => p + 1)}
                style={{ padding: '8px 16px' }}
                disabled={blocks.length === 0}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
