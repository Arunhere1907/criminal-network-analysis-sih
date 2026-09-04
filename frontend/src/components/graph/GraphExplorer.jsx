import React, { useEffect, useRef, useState, useCallback } from 'react';
import cytoscape from 'cytoscape';
import { Search, X } from 'lucide-react';
import { fetchGraph } from '../../api';
import NodeDetailPanel from './NodeDetailPanel';
import GraphControls from './GraphControls';
import GraphLegend from './GraphLegend';
import { cn } from '../../lib/utils';

/* Restrained role palette — distinguishable, not rainbow */
const ROLE_COLORS = {
  peddler: '#9F1239',
  supplier: '#9A3412',
  courier: '#92400E',
  financier: '#1E3A5F',
  associate: '#334155',
  contact: '#78716C',
};

const EDGE_COLORS = {
  comm_edge: '#94A3B8',
  financial_edge: '#047857',
  location_edge: '#B45309',
  case_edge: '#9F1239',
};

function buildStylesheet(showLabels) {
  return [
    {
      selector: 'node',
      style: {
        'background-color': (ele) => ROLE_COLORS[ele.data('role')] || ROLE_COLORS.contact,
        label: showLabels ? 'data(label)' : '',
        color: '#1C1917',
        'text-background-color': '#F7F6F4',
        'text-background-opacity': 0.92,
        'text-background-padding': '3px',
        'text-background-shape': 'roundrectangle',
        'text-valign': 'bottom',
        'text-halign': 'center',
        'text-margin-y': 5,
        'font-size': '10px',
        'font-family': 'IBM Plex Sans, sans-serif',
        'font-weight': 500,
        width: (ele) => Math.max(16, Math.min(42, (ele.data('degree') || 1) * 3.5 + 14)),
        height: (ele) => Math.max(16, Math.min(42, (ele.data('degree') || 1) * 3.5 + 14)),
        'border-width': 1.5,
        'border-color': '#FFFFFF',
      },
    },
    {
      selector: 'edge',
      style: {
        width: (ele) => {
          const score = ele.data('riskScore') || 0;
          const status = ele.data('status') || '';
          if (status === 'potential_risk') return Math.max(2.5, score * 5);
          if (status === 'confirmed') return Math.max(2, score * 3 + 1);
          return Math.max(0.8, score * 2 + 0.6);
        },
        'line-color': (ele) => {
          const status = ele.data('status') || '';
          if (status === 'potential_risk') return '#B45309';
          if (status === 'confirmed') return '#166534';
          if (status === 'dismissed') return '#D6D3D1';
          return EDGE_COLORS[ele.data('type')] || '#CBD5E1';
        },
        'line-style': (ele) => {
          const status = ele.data('status') || '';
          if (status === 'potential_risk') return 'dashed';
          if (status === 'candidate') return 'dotted';
          return 'solid';
        },
        'line-dash-pattern': [7, 4],
        'curve-style': 'bezier',
        'target-arrow-shape': 'triangle',
        'target-arrow-color': (ele) => {
          const status = ele.data('status') || '';
          if (status === 'potential_risk') return '#B45309';
          if (status === 'confirmed') return '#166534';
          if (status === 'dismissed') return '#D6D3D1';
          return EDGE_COLORS[ele.data('type')] || '#CBD5E1';
        },
        'arrow-scale': 0.7,
        opacity: (ele) => {
          const status = ele.data('status') || '';
          if (status === 'dismissed') return 0.25;
          if (status === 'candidate') return 0.45;
          if (status === 'potential_risk') return 0.95;
          return 0.7;
        },
      },
    },
    {
      selector: 'node:selected',
      style: {
        'border-width': 3,
        'border-color': '#1E3A5F',
      },
    },
    {
      selector: '.faded',
      style: { opacity: 0.1 },
    },
    {
      selector: '.highlighted',
      style: { opacity: 1 },
    },
    {
      selector: 'node.filtered-out, edge.filtered-out',
      style: { display: 'none' },
    },
  ];
}

export default function GraphExplorer({ focusRequest }) {
  const containerRef = useRef(null);
  const cyRef = useRef(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showLabels, setShowLabels] = useState(true);
  const [showRisk, setShowRisk] = useState(true);
  const [legendCollapsed, setLegendCollapsed] = useState(false);
  const [roleFilter, setRoleFilter] = useState('all');
  const [edgeFilter, setEdgeFilter] = useState('all');
  const [stats, setStats] = useState({ nodes: 0, edges: 0 });

  const selectNode = useCallback((nodeId) => {
    const cy = cyRef.current;
    if (!cy || !nodeId) return;
    const node = cy.getElementById(nodeId);
    if (!node || node.empty()) return;

    cy.elements().removeClass('faded highlighted');
    cy.elements().addClass('faded');
    node.removeClass('faded').addClass('highlighted');
    node.neighborhood().removeClass('faded').addClass('highlighted');
    cy.fit(node.closedNeighborhood(), 90);
    node.select();
    setSelectedNodeId(nodeId);
  }, []);

  const loadGraph = useCallback(() => {
    setLoading(true);
    setError(null);

    return fetchGraph()
      .then((res) => {
        const data = res.data;
        const elements = [];

        if (data.nodes) {
          data.nodes.forEach((node) => {
            const props = node.properties || node;
            const nodeId = props.node_id || node.id;
            if (!nodeId) return;
            elements.push({
              data: {
                id: nodeId,
                label: (props.names && props.names[0]) || nodeId,
                role: props.role || 'contact',
                degree: props.degree || 1,
              },
            });
          });
        }

        // Fallback degree from edge incidence when API omits it
        const degreeMap = {};
        if (data.edges) {
          data.edges.forEach((edge) => {
            const props = edge.properties || {};
            const source = edge.source || props.source;
            const target = edge.target || props.target;
            if (source) degreeMap[source] = (degreeMap[source] || 0) + 1;
            if (target) degreeMap[target] = (degreeMap[target] || 0) + 1;
          });
        }
        elements.forEach((el) => {
          if (el.data?.id && !el.data.source && degreeMap[el.data.id]) {
            if (!el.data.degree || el.data.degree === 1) {
              el.data.degree = degreeMap[el.data.id];
            }
          }
        });

        if (data.edges) {
          data.edges.forEach((edge) => {
            const props = edge.properties || {};
            const edgeId = props.edge_id || edge.id;
            const source = edge.source || props.source;
            const target = edge.target || props.target;
            if (!edgeId || !source || !target) return;
            elements.push({
              data: {
                id: edgeId,
                source,
                target,
                type: props.edge_type || edge.type || 'comm_edge',
                status: props.status || edge.status || 'candidate',
                riskScore: props.risk_score || edge.risk_score || 0,
              },
            });
          });
        }

        if (cyRef.current) {
          cyRef.current.destroy();
          cyRef.current = null;
        }

        const cy = cytoscape({
          container: containerRef.current,
          elements,
          style: buildStylesheet(showLabels),
          layout: {
            name: 'cose',
            padding: 48,
            nodeRepulsion: 480000,
            idealEdgeLength: 110,
            edgeElasticity: 80,
            gravity: 180,
            numIter: 900,
            animate: false,
          },
          minZoom: 0.15,
          maxZoom: 4,
          wheelSensitivity: 0.25,
        });

        cy.on('tap', 'node', (evt) => {
          selectNode(evt.target.id());
        });

        cy.on('tap', (evt) => {
          if (evt.target === cy) {
            setSelectedNodeId(null);
            cy.elements().removeClass('faded highlighted');
            cy.nodes().unselect();
          }
        });

        cyRef.current = cy;
        setStats({ nodes: cy.nodes().length, edges: cy.edges().length });
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching graph:', err);
        setError('Unable to load network data. Ensure the backend is running on port 8000.');
        setLoading(false);
      });
  }, [selectNode, showLabels]);

  useEffect(() => {
    loadGraph();
    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!cyRef.current) return;
    cyRef.current.style(buildStylesheet(showLabels));
  }, [showLabels]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.elements().removeClass('filtered-out');

    if (roleFilter !== 'all') {
      cy.nodes().forEach((n) => {
        if (n.data('role') !== roleFilter) n.addClass('filtered-out');
      });
      cy.edges().forEach((e) => {
        if (e.source().hasClass('filtered-out') || e.target().hasClass('filtered-out')) {
          e.addClass('filtered-out');
        }
      });
    }

    if (edgeFilter !== 'all') {
      cy.edges().forEach((e) => {
        if (edgeFilter === 'potential_risk') {
          if (e.data('status') !== 'potential_risk') e.addClass('filtered-out');
        } else if (e.data('type') !== edgeFilter) {
          e.addClass('filtered-out');
        }
      });
    }
  }, [roleFilter, edgeFilter, loading]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || loading) return;

    if (showRisk) {
      cy.edges('[status = "potential_risk"]').forEach((edge) => {
        edge.style('opacity', 1);
      });
    }
  }, [showRisk, loading]);

  useEffect(() => {
    if (!focusRequest?.nodeIds?.length || !cyRef.current || loading) return;
    const cy = cyRef.current;
    const ids = focusRequest.nodeIds;
    cy.elements().removeClass('faded highlighted');
    cy.elements().addClass('faded');
    const collection = cy.collection();
    ids.forEach((id) => {
      const n = cy.getElementById(id);
      if (n && !n.empty()) {
        n.removeClass('faded').addClass('highlighted');
        n.neighborhood().removeClass('faded').addClass('highlighted');
        collection.merge(n);
      }
    });
    if (collection.length) {
      cy.fit(collection, 80);
      selectNode(ids[0]);
    }
  }, [focusRequest, loading, selectNode]);

  const updateSuggestions = (q) => {
    if (!cyRef.current || !q.trim()) {
      setSuggestions([]);
      return;
    }
    const query = q.toLowerCase();
    const matches = cyRef.current
      .nodes()
      .filter(
        (n) =>
          n.data('id').toLowerCase().includes(query) ||
          n.data('label').toLowerCase().includes(query)
      )
      .slice(0, 6)
      .map((n) => ({ id: n.data('id'), label: n.data('label'), role: n.data('role') }));
    setSuggestions(matches);
  };

  const handleSearch = useCallback(
    (e) => {
      e?.preventDefault?.();
      if (!searchQuery.trim()) return;
      const q = searchQuery.toLowerCase().trim();
      const cy = cyRef.current;
      if (!cy) return;
      const target = cy.nodes().filter(
        (n) =>
          n.data('id').toLowerCase().includes(q) ||
          n.data('label').toLowerCase().includes(q)
      );
      if (target.length > 0) {
        selectNode(target[0].id());
        setSuggestions([]);
      }
    },
    [searchQuery, selectNode]
  );

  const handleClearSearch = () => {
    setSearchQuery('');
    setSuggestions([]);
    if (cyRef.current) {
      cyRef.current.elements().removeClass('faded highlighted');
      setSelectedNodeId(null);
    }
  };

  return (
    <div className="relative w-full h-full bg-background">
      <div className="absolute top-0 left-0 right-0 z-10 flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 min-h-12 py-2 bg-surface border-b border-border">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-[14px] font-semibold text-foreground shrink-0">Network Explorer</h1>
          {!loading && !error && (
            <span className="hidden sm:inline text-[11px] text-muted-foreground truncate">
              {stats.nodes} persons · {stats.edges} relationships
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <form onSubmit={handleSearch} className="relative">
            <div
              className={cn(
                'flex items-center gap-2 h-8 px-3 rounded border text-[13px] transition-colors bg-surface',
                searchFocused ? 'border-primary ring-1 ring-primary/20' : 'border-border'
              )}
            >
              <Search size={13} className="text-muted-foreground shrink-0" aria-hidden />
              <input
                type="text"
                placeholder="Search person or node ID…"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  updateSuggestions(e.target.value);
                }}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                className="w-40 sm:w-56 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
                aria-label="Search person or node ID"
                autoComplete="off"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            {searchFocused && suggestions.length > 0 && (
              <ul className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded shadow-sm z-30 overflow-hidden">
                {suggestions.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-[12px] hover:bg-muted flex items-center justify-between gap-2"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setSearchQuery(s.label);
                        selectNode(s.id);
                        setSuggestions([]);
                      }}
                    >
                      <span className="font-medium text-foreground truncate">{s.label}</span>
                      <span className="font-mono text-[10px] text-muted-foreground shrink-0">{s.id}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </form>

          <GraphControls
            cy={cyRef.current}
            showLabels={showLabels}
            onToggleLabels={() => setShowLabels((v) => !v)}
            showRisk={showRisk}
            onToggleRisk={() => setShowRisk((v) => !v)}
            roleFilter={roleFilter}
            onRoleFilter={setRoleFilter}
            edgeFilter={edgeFilter}
            onEdgeFilter={setEdgeFilter}
            onReload={loadGraph}
          />
        </div>
      </div>

      <div
        ref={containerRef}
        className="absolute inset-0 top-12 cy-container"
        style={{ background: '#F7F6F4' }}
      />

      {loading && (
        <div className="absolute inset-0 top-12 flex flex-col items-center justify-center bg-background z-10">
          <div className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin mb-3" />
          <p className="text-[13px] text-muted-foreground">Loading network graph…</p>
        </div>
      )}

      {error && !loading && (
        <div className="absolute inset-0 top-12 flex flex-col items-center justify-center bg-background z-10 px-4">
          <p className="text-[14px] font-medium text-foreground mb-1">Network unavailable</p>
          <p className="text-[12px] text-muted-foreground text-center max-w-sm">{error}</p>
          <button
            type="button"
            onClick={loadGraph}
            className="mt-4 h-8 px-3 text-[12px] font-medium border border-border rounded bg-surface hover:bg-muted"
          >
            Retry
          </button>
        </div>
      )}

      <div className="absolute bottom-4 left-3 sm:left-4 z-10">
        <GraphLegend
          collapsed={legendCollapsed}
          onToggle={() => setLegendCollapsed((v) => !v)}
        />
      </div>

      <NodeDetailPanel
        nodeId={selectedNodeId}
        onClose={() => {
          setSelectedNodeId(null);
          if (cyRef.current) {
            cyRef.current.elements().removeClass('faded highlighted');
            cyRef.current.nodes().unselect();
          }
        }}
        onGraphRefresh={loadGraph}
      />
    </div>
  );
}
