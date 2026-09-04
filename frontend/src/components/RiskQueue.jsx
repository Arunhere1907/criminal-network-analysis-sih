import React, { useEffect, useState } from 'react';
import { fetchRiskQueue, confirmRisk, dismissRisk } from '../api';

export default function RiskQueue() {
  const [risks, setRisks] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadRisks = () => {
    setLoading(true);
    fetchRiskQueue().then(res => {
      // API returns {items: [...]} with fields source_id, target_id, source_names, target_names
      const items = res.data.items || res.data || [];
      const sorted = items.sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0));
      setRisks(sorted);
    }).catch(err => console.error(err)).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRisks();
  }, []);

  const handleConfirm = (edgeId) => {
    confirmRisk(edgeId).then(() => loadRisks()).catch(err => console.error(err));
  };

  const handleDismiss = (edgeId) => {
    dismissRisk(edgeId).then(() => loadRisks()).catch(err => console.error(err));
  };

  const getScoreColor = (score) => {
    if (score < 0.55) return '#2ecc71';
    if (score <= 0.75) return '#f39c12';
    return '#e74c3c';
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="view-header">
        <h2>Risk Queue <span className="count-badge">{risks.length}</span></h2>
        <button onClick={loadRisks} style={{ padding: '8px 16px', cursor: 'pointer' }}>Refresh</button>
      </div>
      
      <div className="table-container">
        {loading ? <p>Loading risks...</p> : (
          <table>
            <thead>
              <tr>
                <th>Edge / Entities</th>
                <th>Edge Type</th>
                <th>Risk Score</th>
                <th>Evidence Breakdown</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {risks.map(risk => (
                <tr key={risk.edge_id}>
                  <td>
                    <div>
                      <strong>{(risk.source_names || []).join(', ') || risk.source_id}</strong>
                      &rarr;
                      <strong>{(risk.target_names || []).join(', ') || risk.target_id}</strong>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Edge ID: {risk.edge_id}</div>
                  </td>
                  <td>
                    <span className="badge">{risk.edge_type}</span>
                  </td>
                  <td>
                    <div>{(risk.risk_score || 0).toFixed(3)}</div>
                    <div className="score-bar-wrapper">
                      <div 
                        className="score-bar" 
                        style={{ 
                          width: `${Math.min(100, (risk.risk_score || 0) * 100)}%`, 
                          backgroundColor: getScoreColor(risk.risk_score || 0) 
                        }} 
                      />
                    </div>
                  </td>
                  <td>
                    <details>
                      <summary style={{ cursor: 'pointer', color: 'var(--text-muted)' }}>Show Evidence</summary>
                      <div style={{ marginTop: '10px', fontSize: '0.85rem' }}>
                        {(risk.evidence || []).map((ev, i) => (
                          <div key={i} style={{ marginBottom: '4px' }}>
                            • {ev.type} (Contrib: {ev.contribution})
                          </div>
                        ))}
                      </div>
                    </details>
                  </td>
                  <td>
                    <button className="action-btn btn-confirm" onClick={() => handleConfirm(risk.edge_id)}>Confirm</button>
                    <button className="action-btn btn-dismiss" onClick={() => handleDismiss(risk.edge_id)}>Dismiss</button>
                  </td>
                </tr>
              ))}
              {risks.length === 0 && (
                <tr><td colSpan="5" style={{ textAlign: 'center' }}>No potential risks in queue.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
