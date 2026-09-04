import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import { fetchGraph } from '../api';
import NodeDetailPanel from './NodeDetailPanel';

const ROLE_COLORS = {
  peddler: '#e74c3c', // red
  supplier: '#e67e22', // orange
  courier: '#f39c12', // yellow
  financier: '#9b59b6', // purple
  associate: '#3498db', // blue
  contact: '#95a5a6' // gray
};

const EDGE_COLORS = {
  comm_edge: '#3498db',
  financial_edge: '#2ecc71',
  location_edge: '#e67e22',
  case_edge: '#e74c3c'
};

export default function GraphExplorer() {
  const containerRef = useRef(null);
  const cyRef = useRef(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let mounted = true;
    
    fetchGraph().then(res => {
      if (!mounted) return;
      const data = res.data;
      
      const elements = [];
      
      if (data.nodes) {
        data.nodes.forEach(node => {
          const props = node.properties || node;
          const nodeId = props.node_id || node.id;
          if (!nodeId) return;
          elements.push({
            data: {
              id: nodeId,
              label: (props.names && props.names[0]) || nodeId,
              role: props.role || 'contact',
              degree: props.degree || 1
            }
          });
        });
      }
      
      if (data.edges) {
        data.edges.forEach(edge => {
          const props = edge.properties || {};
          const edgeId = props.edge_id || edge.id;
          const source = edge.source || props.source;
          const target = edge.target || props.target;
          if (!edgeId || !source || !target) return;
          elements.push({
            data: {
              id: edgeId,
              source: source,
              target: target,
              type: props.edge_type || edge.type || 'comm_edge',
              status: props.status || edge.status || 'candidate',
              riskScore: props.risk_score || edge.risk_score || 0
            }
          });
        });
      }

      const cy = cytoscape({
        container: containerRef.current,
        elements: elements,
        style: [
          {
            selector: 'node',
            style: {
              'background-color': (ele) => ROLE_COLORS[ele.data('role')] || ROLE_COLORS.contact,
              'label': 'data(label)',
              'color': '#fff',
              'text-outline-color': '#000',
              'text-outline-width': 2,
              'font-size': '12px',
              'width': (ele) => Math.max(20, Math.min(60, ele.data('degree') * 5 + 15)),
              'height': (ele) => Math.max(20, Math.min(60, ele.data('degree') * 5 + 15))
            }
          },
          {
            selector: 'edge',
            style: {
              'width': (ele) => Math.max(1, ele.data('riskScore') * 5),
              'line-color': (ele) => EDGE_COLORS[ele.data('type')] || '#888',
              'line-style': (ele) => ele.data('status') === 'candidate' ? 'dashed' : 'solid',
              'curve-style': 'bezier',
              'target-arrow-shape': 'triangle',
              'target-arrow-color': (ele) => EDGE_COLORS[ele.data('type')] || '#888',
              'opacity': 0.8
            }
          },
          {
            selector: ':selected',
            style: {
              'border-width': 4,
              'border-color': '#fff'
            }
          }
        ],
        layout: {
          name: 'cose',
          padding: 30,
          nodeRepulsion: 400000,
          idealEdgeLength: 100,
          edgeElasticity: 100,
          gravity: 250
        }
      });

      cy.on('tap', 'node', (evt) => {
        const node = evt.target;
        setSelectedNodeId(node.id());
      });

      cy.on('tap', (evt) => {
        if (evt.target === cy) {
          setSelectedNodeId(null);
        }
      });

      cyRef.current = cy;
    }).catch(err => console.error("Error fetching graph:", err));

    return () => {
      mounted = false;
      if (cyRef.current) cyRef.current.destroy();
    };
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!cyRef.current || !searchQuery) return;
    
    const nodes = cyRef.current.nodes();
    const targetNode = nodes.filter(n => 
      n.data('id').toLowerCase().includes(searchQuery.toLowerCase()) || 
      n.data('label').toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    if (targetNode.length > 0) {
      cyRef.current.fit(targetNode, 50);
      targetNode.select();
      setSelectedNodeId(targetNode[0].id());
    }
  };

  return (
    <div className="graph-container">
      <form className="graph-search" onSubmit={handleSearch}>
        <input 
          type="text" 
          placeholder="Search by ID or Name..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button type="submit">Search</button>
      </form>

      <div id="cy" ref={containerRef}></div>
      
      <div className="graph-legend">
        <div className="legend-section">
          <strong>Node Roles</strong>
          {Object.entries(ROLE_COLORS).map(([role, color]) => (
            <div className="legend-item" key={role}>
              <div className="color-box" style={{ backgroundColor: color }}></div>
              <span>{role}</span>
            </div>
          ))}
        </div>
        <div className="legend-section">
          <strong>Edge Types</strong>
          {Object.entries(EDGE_COLORS).map(([type, color]) => (
            <div className="legend-item" key={type}>
              <div className="color-box" style={{ backgroundColor: color }}></div>
              <span>{type}</span>
            </div>
          ))}
        </div>
      </div>

      <NodeDetailPanel 
        nodeId={selectedNodeId} 
        onClose={() => setSelectedNodeId(null)} 
      />
    </div>
  );
}
