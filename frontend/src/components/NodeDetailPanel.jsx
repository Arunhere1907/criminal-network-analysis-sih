import React, { useEffect, useState } from 'react';
import { fetchNode, fetchCentrality } from '../api';

export default function NodeDetailPanel({ nodeId, onClose }) {
  const [nodeData, setNodeData] = useState(null);
  const [centralityData, setCentralityData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!nodeId) return;
    
    setLoading(true);
    setNodeData(null);
    setCentralityData(null);

    Promise.all([
      fetchNode(nodeId).catch(() => ({ data: null })),
      fetchCentrality(nodeId).catch(() => ({ data: null }))
    ]).then(([nodeRes, centRes]) => {
      if (nodeRes.data) setNodeData(nodeRes.data);
      if (centRes.data) setCentralityData(centRes.data);
      setLoading(false);
    });
  }, [nodeId]);

  return (
    <div className={`node-detail-panel ${nodeId ? 'open' : ''}`}>
      <div className="panel-header">
        <h3>Node Details</h3>
        <button className="close-btn" onClick={onClose}>&times;</button>
      </div>
      
      <div className="panel-content">
        {!nodeId && <p>Select a node to view details.</p>}
        {loading && <p>Loading...</p>}
        
        {nodeData && (
          <>
            <div className="detail-section">
              <h4>Properties</h4>
              <div className="prop-row">
                <span className="prop-label">ID</span>
                <span className="prop-value">{nodeData.node?.node_id || nodeId}</span>
              </div>
              <div className="prop-row">
                <span className="prop-label">Names</span>
                <span className="prop-value">{(nodeData.node?.names || []).join(', ') || 'N/A'}</span>
              </div>
              <div className="prop-row">
                <span className="prop-label">Role</span>
                <span className="prop-value">{nodeData.node?.role || 'N/A'}</span>
              </div>
              <div className="prop-row">
                <span className="prop-label">Phone</span>
                <span className="prop-value">{nodeData.node?.phone || 'N/A'}</span>
              </div>
              <div className="prop-row">
                <span className="prop-label">City</span>
                <span className="prop-value">{nodeData.node?.city || 'N/A'}</span>
              </div>
              <div className="prop-row">
                <span className="prop-label">Bail Status</span>
                <span className="prop-value">{nodeData.node?.bail_status || 'none'}</span>
              </div>
              <div className="prop-row">
                <span className="prop-label">Prior Cases</span>
                <span className="prop-value">{(nodeData.node?.prior_cases || []).join(', ') || 'None'}</span>
              </div>
            </div>

            {centralityData && (
              <div className="detail-section">
                <h4>Network Centrality</h4>
                <div className="prop-row" style={{ display: 'block' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>PageRank</span>
                    <span>{(centralityData.pagerank || 0).toFixed(4)}</span>
                  </div>
                  <div className="bar-container">
                    <div className="bar-fill" style={{ width: `${Math.min(100, (centralityData.pagerank || 0) * 1000)}%`, backgroundColor: '#3498db' }}></div>
                  </div>
                </div>
                <div className="prop-row" style={{ display: 'block', marginTop: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Betweenness</span>
                    <span>{(centralityData.betweenness || 0).toFixed(4)}</span>
                  </div>
                  <div className="bar-container">
                    <div className="bar-fill" style={{ width: `${Math.min(100, (centralityData.betweenness || 0) * 100)}%`, backgroundColor: '#e74c3c' }}></div>
                  </div>
                </div>
              </div>
            )}

            <div className="detail-section">
              <h4>Timeline Events</h4>
              {nodeData.timeline && nodeData.timeline.length > 0 ? (
                nodeData.timeline.map((ev, i) => (
                  <div className="timeline-item" key={i}>
                    <div className="timeline-icon">🕒</div>
                    <div className="timeline-content">
                      <div>{ev.event_type || ev.type || 'Event'} — {ev.description || ''}</div>
                      <div className="timeline-time">{ev.timestamp || 'Unknown Time'}</div>
                      {ev.record_id && <div style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>Ref: {ev.record_id}</div>}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted">No timeline events found.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
