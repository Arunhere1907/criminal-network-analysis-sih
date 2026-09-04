import React, { useEffect, useState } from 'react';
import {
  X,
  Phone,
  Banknote,
  MapPin,
  FileText,
  Waypoints,
  Clock,
  AlertCircle,
  User,
  GitBranch,
  Loader2,
} from 'lucide-react';
import { fetchNode, fetchCentrality, fetchRootCause } from '../../api';
import { RoleBadge } from '../ui/Badge';
import { Skeleton } from '../ui/Skeleton';
import {
  cn,
  formatTimestamp,
  formatBailStatus,
  formatEventType,
} from '../../lib/utils';

function MetaRow({ label, children }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className="text-[11px] font-medium text-muted-foreground w-20 shrink-0 pt-0.5 uppercase tracking-wide">
        {label}
      </span>
      <div className="flex-1 text-[13px] text-foreground leading-tight">{children}</div>
    </div>
  );
}

function CentralityBar({ label, value, max, color, note }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  return (
    <div className="mb-3">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[12px] text-muted-foreground">{label}</span>
        <span className="text-[12px] font-mono font-semibold text-foreground">
          {value.toFixed(4)}
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      {note && <p className="mt-1 text-[11px] text-muted-foreground">{note}</p>}
    </div>
  );
}

function getEventIcon(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('call') || t.includes('comm')) return Phone;
  if (t.includes('financial') || t.includes('transact')) return Banknote;
  if (t.includes('coloc') || t.includes('location')) return MapPin;
  if (t.includes('case') || t.includes('fir')) return FileText;
  return Clock;
}

function getEventColor(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('call') || t.includes('comm')) return 'text-slate-600 bg-slate-100';
  if (t.includes('financial') || t.includes('transact')) return 'text-emerald-700 bg-emerald-50';
  if (t.includes('coloc') || t.includes('location')) return 'text-amber-700 bg-amber-50';
  if (t.includes('case') || t.includes('fir')) return 'text-red-700 bg-red-50';
  return 'text-muted-foreground bg-muted';
}

export default function NodeDetailPanel({ nodeId, onClose }) {
  const [nodeData, setNodeData] = useState(null);
  const [centralityData, setCentralityData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rootCause, setRootCause] = useState(null);
  const [tracing, setTracing] = useState(false);
  const [traceError, setTraceError] = useState(null);

  useEffect(() => {
    if (!nodeId) return;

    setLoading(true);
    setNodeData(null);
    setCentralityData(null);
    setRootCause(null);
    setTraceError(null);
    setError(null);

    Promise.all([
      fetchNode(nodeId).catch(() => ({ data: null })),
      fetchCentrality(nodeId).catch(() => ({ data: null })),
    ])
      .then(([nodeRes, centRes]) => {
        if (nodeRes.data) setNodeData(nodeRes.data);
        if (centRes.data) setCentralityData(centRes.data);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load subject details.');
        setLoading(false);
      });
  }, [nodeId]);

  const isOpen = !!nodeId;
  const node = nodeData?.node;
  const timeline = nodeData?.timeline || [];
  const pr = centralityData?.pagerank || 0;
  const bc = centralityData?.betweenness || 0;
  const degree = node?.degree ?? 0;
  const showBridgeInsight =
    node?.role === 'financier' ||
    (bc > 0.04 && degree > 0 && degree <= 20);

  const priorCases = node?.prior_cases || [];
  const seizedFir =
    priorCases.find((c) => String(c).includes('2026-0042')) ||
    priorCases[0] ||
    'FIR-2026-0042';

  const handleTrace = (eventId) => {
    setTracing(true);
    setTraceError(null);
    setRootCause(null);
    fetchRootCause(eventId)
      .then((res) => setRootCause(res.data))
      .catch(() => setTraceError('Unable to trace root cause for this event.'))
      .finally(() => setTracing(false));
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <button
          type="button"
          className="absolute inset-0 top-12 bg-foreground/10 z-20 md:hidden"
          aria-label="Close panel"
          onClick={onClose}
        />
      )}

      <div
        className={cn(
          'absolute top-12 right-0 bottom-0 w-full sm:w-[380px] bg-surface border-l border-border flex flex-col',
          'transition-transform duration-200 ease-out z-30',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        role="dialog"
        aria-label="Subject investigation panel"
        aria-hidden={!isOpen}
      >
        <div className="flex items-center justify-between px-4 h-12 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <User size={14} className="text-muted-foreground shrink-0" />
            <span className="text-[13px] font-semibold text-foreground truncate">
              {loading ? 'Loading…' : node ? node.names?.[0] || nodeId : 'Subject'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Close panel"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="p-4 space-y-6">
              <div className="space-y-2">
                <Skeleton className="h-3 w-24" />
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            </div>
          )}

          {error && !loading && (
            <div className="p-4 flex items-center gap-2 text-risk">
              <AlertCircle size={14} />
              <span className="text-[12px]">{error}</span>
            </div>
          )}

          {!loading && !error && node && (
            <>
              <div className="px-4 pt-4 pb-3 border-b border-border">
                <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase mb-2">
                  Identity
                </p>

                <MetaRow label="Node ID">
                  <span className="font-mono text-[12px] text-muted-foreground">
                    {node.node_id || nodeId}
                  </span>
                </MetaRow>

                {node.names?.length > 0 && (
                  <MetaRow label="Known as">
                    <div className="space-y-0.5">
                      {node.names.map((name, i) => (
                        <div
                          key={i}
                          className={cn(
                            'text-[13px]',
                            i === 0 ? 'font-medium text-foreground' : 'text-muted-foreground'
                          )}
                        >
                          {name}
                        </div>
                      ))}
                    </div>
                  </MetaRow>
                )}

                <MetaRow label="Role">
                  <RoleBadge role={node.role} />
                </MetaRow>

                {(node.addresses?.length > 0 || node.city) && (
                  <MetaRow label="Address">
                    {node.addresses?.length
                      ? node.addresses.join('; ')
                      : node.city}
                  </MetaRow>
                )}

                <MetaRow label="Bail">
                  <span
                    className={cn(
                      'text-[12px] font-medium',
                      node.bail_status === 'absconding'
                        ? 'text-risk'
                        : node.bail_status === 'on_bail'
                          ? 'text-warning'
                          : 'text-muted-foreground'
                    )}
                  >
                    {formatBailStatus(node.bail_status)}
                  </span>
                </MetaRow>

                {priorCases.length > 0 && (
                  <MetaRow label="Prior cases">
                    <div className="flex flex-wrap gap-1">
                      {priorCases.map((c, i) => (
                        <span
                          key={i}
                          className="font-mono text-[11px] text-risk bg-red-50 px-1.5 py-0.5 rounded-sm border border-red-100"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </MetaRow>
                )}
              </div>

              {centralityData && (
                <div className="px-4 pt-4 pb-3 border-b border-border">
                  <div className="flex items-center gap-2 mb-3">
                    <Waypoints size={12} className="text-muted-foreground" />
                    <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                      Network Position
                    </p>
                  </div>

                  <CentralityBar
                    label="PageRank"
                    value={pr}
                    max={Math.max(pr * 1.2, 0.01)}
                    color="#1E3A5F"
                    note="Influence from connected neighbours"
                  />
                  <CentralityBar
                    label="Betweenness Centrality"
                    value={bc}
                    max={Math.max(bc * 1.2, 0.01)}
                    color="#B91C1C"
                    note="Bridge control across network paths"
                  />

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="border border-border rounded-sm p-2 text-center">
                      <div className="font-mono text-[13px] font-semibold text-foreground">
                        {pr.toFixed(4)}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">PageRank</div>
                    </div>
                    <div className="border border-border rounded-sm p-2 text-center ring-1 ring-risk/30 bg-red-50/40">
                      <div className="font-mono text-[13px] font-semibold text-foreground">
                        {bc.toFixed(4)}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">Betweenness</div>
                    </div>
                    <div className="border border-border rounded-sm p-2 text-center">
                      <div className="font-mono text-[13px] font-semibold text-foreground">
                        {degree || '—'}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">Degree</div>
                    </div>
                  </div>

                  <p className="mt-2 text-[11px] text-muted-foreground leading-snug">
                    Betweenness measures bridge control. Degree counts direct links.
                    A hidden intermediary often shows elevated betweenness with modest degree.
                  </p>

                  {showBridgeInsight && (
                    <div className="mt-3 p-2.5 border border-amber-200 bg-amber-50/80 text-[11px] text-amber-900 leading-snug">
                      <strong>High betweenness ≠ high degree.</strong> This subject can bridge
                      network paths without being the most connected node — a pattern consistent
                      with a hidden intermediary such as a silent financier.
                    </div>
                  )}
                </div>
              )}

              {/* Root cause */}
              <div className="px-4 pt-4 pb-3 border-b border-border">
                <div className="flex items-center gap-2 mb-3">
                  <GitBranch size={12} className="text-muted-foreground" />
                  <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                    Root Cause
                  </p>
                </div>
                <p className="text-[12px] text-muted-foreground mb-3 leading-snug">
                  Trace origin from a case event backward through linked relationships.
                </p>
                <button
                  type="button"
                  onClick={() => handleTrace(seizedFir)}
                  disabled={tracing}
                  className="h-8 px-3 text-[12px] font-medium border border-border rounded bg-surface hover:bg-muted disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {tracing ? <Loader2 size={12} className="animate-spin" /> : <GitBranch size={12} />}
                  {tracing ? 'Tracing…' : `Trace origin · ${seizedFir}`}
                </button>

                {traceError && (
                  <p className="mt-2 text-[11px] text-risk">{traceError}</p>
                )}

                {rootCause && (
                  <div className="mt-3 space-y-2">
                    <p className="text-[11px] font-medium text-foreground">
                      Causal chain from {rootCause.event_id}
                    </p>
                    {(rootCause.path || []).length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">No path found.</p>
                    ) : (
                      <ol className="relative pl-4 space-y-2">
                        <div className="absolute left-[7px] top-1 bottom-1 w-px bg-border" />
                        {rootCause.path.map((step, i) => (
                          <li key={i} className="relative flex items-start gap-2">
                            <span className="w-3.5 h-3.5 rounded-full bg-primary border-2 border-surface shrink-0 mt-0.5 z-10" />
                            <div>
                              <div className="text-[12px] font-medium text-foreground">
                                {(step.names && step.names[0]) || step.node_id}
                              </div>
                              <div className="font-mono text-[10px] text-muted-foreground">
                                {step.node_id}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                    {rootCause.earliest_event && (
                      <div className="mt-2 p-2 border border-border bg-muted/50 text-[11px]">
                        <span className="text-muted-foreground">Earliest linked event · </span>
                        <span className="font-mono">{rootCause.earliest_event.node_id}</span>
                        {rootCause.earliest_event.timestamp &&
                          rootCause.earliest_event.timestamp !== '9999-99-99' && (
                            <span className="text-muted-foreground">
                              {' '}
                              · {formatTimestamp(rootCause.earliest_event.timestamp)}
                            </span>
                          )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="px-4 pt-4 pb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={12} className="text-muted-foreground" />
                  <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                    Evidence Timeline
                  </p>
                  {timeline.length > 0 && (
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {timeline.length} events
                    </span>
                  )}
                </div>

                {timeline.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground">No timeline events on record.</p>
                ) : (
                  <div className="relative">
                    <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />
                    <div className="space-y-3">
                      {timeline.map((ev, i) => {
                        const Icon = getEventIcon(ev.event_type || ev.type);
                        const colorClass = getEventColor(ev.event_type || ev.type);
                        return (
                          <div key={i} className="relative flex items-start gap-3 pl-1">
                            <div
                              className={cn(
                                'w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 relative z-10',
                                colorClass
                              )}
                            >
                              <Icon size={10} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[12px] font-medium text-foreground leading-tight">
                                {formatEventType(ev.event_type || ev.type)}
                              </div>
                              {ev.description && (
                                <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                                  {ev.description}
                                </div>
                              )}
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="text-[10px] text-muted-foreground">
                                  {formatTimestamp(ev.timestamp)}
                                </span>
                                {(ev.record_id || ev.source_id) && (
                                  <span className="font-mono text-[10px] text-muted-foreground">
                                    {ev.record_id || ev.source_id}
                                  </span>
                                )}
                              </div>
                              {(ev.record_id || ev.fir_id) && (
                                <button
                                  type="button"
                                  onClick={() => handleTrace(ev.fir_id || ev.record_id || seizedFir)}
                                  className="mt-1.5 text-[10px] font-medium text-primary hover:underline"
                                >
                                  Trace origin
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {!loading && !error && !node && nodeId && (
            <div className="p-4">
              <p className="text-[13px] text-muted-foreground">
                Subject data not found for {nodeId}.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
