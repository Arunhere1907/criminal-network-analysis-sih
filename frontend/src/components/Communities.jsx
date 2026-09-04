import React, { useEffect, useState } from 'react';
import { fetchCommunities } from '../api';

export default function Communities() {
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCommunities().then(res => {
      setCommunities(res.data.communities || res.data || []);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="view-header">
        <h2>Detected Communities <span className="count-badge">{communities.length}</span></h2>
      </div>
      
      <div className="communities-container" style={{ overflow: 'auto' }}>
        {loading ? <p>Loading communities...</p> : (
          communities.map((comm, idx) => (
            <div className="card community-card" key={comm.community_id || idx}>
              <h3 style={{ marginBottom: '10px' }}>Community: {comm.community_id}</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
                Members: {comm.members ? comm.members.length : 0}
              </p>
              
              <div style={{ maxHeight: '200px', overflowY: 'auto', backgroundColor: 'var(--primary-bg)', borderRadius: '4px' }}>
                {(comm.members || []).map((member, i) => (
                  <div className="community-member" key={i}>
                    👤 {typeof member === 'object' ? `${member.node_id} — ${(member.names || []).join(', ')}` : member}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
        
        {!loading && communities.length === 0 && (
          <p style={{ padding: '20px' }}>No communities detected.</p>
        )}
      </div>
    </div>
  );
}
