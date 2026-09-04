import React, { useEffect, useState } from 'react';
import { TriangleAlert, RefreshCw, CheckCircle } from 'lucide-react';
import { fetchRiskQueue, confirmRisk, dismissRisk } from '../../api';
import RiskCard from './RiskCard';
import { Skeleton } from '../ui/Skeleton';
import { pairKey } from '../../lib/utils';

function groupRisks(items) {
  const map = new Map();

  items.forEach((item) => {
    const key = pairKey(item.source_id, item.target_id);
    if (!map.has(key)) {
      map.set(key, {
        ...item,
        edge_ids: [item.edge_id],
        evidence: [...(item.evidence || [])],
        edge_types: [item.edge_type],
      });
    } else {
      const g = map.get(key);
      g.edge_ids.push(item.edge_id);
      g.evidence.push(...(item.evidence || []));
      if (!g.edge_types.includes(item.edge_type)) g.edge_types.push(item.edge_type);
      g.risk_score = Math.max(g.risk_score || 0, item.risk_score || 0);
    }
  });

  return Array.from(map.values()).sort(
    (a, b) => (b.risk_score || 0) - (a.risk_score || 0)
  );
}

export default function RiskQueue({ onViewInGraph }) {
  const [risks, setRisks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState({});
  const [dismissing, setDismissing] = useState({});
  const [recentAction, setRecentAction] = useState(null);

  const loadRisks = () => {
    setLoading(true);
    setError(null);
    fetchRiskQueue()
      .then((res) => {
        const items = res.data.items || res.data || [];
        setRisks(groupRisks(items));
      })
      .catch((err) => {
        console.error(err);
        setError('Failed to load risk queue. Ensure the backend is running.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRisks();
  }, []);

  const handleConfirm = async (finding) => {
    const ids = finding.edge_ids || [finding.edge_id];
    const key = finding.edge_id;
    setConfirming((c) => ({ ...c, [key]: true }));
    try {
      await Promise.all(ids.map((id) => confirmRisk(id)));
      setRecentAction({
        type: 'confirmed',
        label: `${(finding.source_names || [])[0] || finding.source_id} ↔ ${(finding.target_names || [])[0] || finding.target_id}`,
      });
      setTimeout(() => setRecentAction(null), 5000);
      loadRisks();
    } catch (err) {
      console.error(err);
    } finally {
      setConfirming((c) => ({ ...c, [key]: false }));
    }
  };

  const handleDismiss = async (finding) => {
    const ids = finding.edge_ids || [finding.edge_id];
    const key = finding.edge_id;
    setDismissing((d) => ({ ...d, [key]: true }));
    try {
      await Promise.all(ids.map((id) => dismissRisk(id)));
      setRecentAction({
        type: 'dismissed',
        label: `${(finding.source_names || [])[0] || finding.source_id} ↔ ${(finding.target_names || [])[0] || finding.target_id}`,
      });
      setTimeout(() => setRecentAction(null), 4000);
      loadRisks();
    } catch (err) {
      console.error(err);
    } finally {
      setDismissing((d) => ({ ...d, [key]: false }));
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex items-center justify-between px-4 sm:px-6 h-12 bg-surface border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <TriangleAlert size={14} className="text-warning shrink-0" />
          <h1 className="text-[14px] font-semibold text-foreground">Potential Risk</h1>
          {!loading && (
            <span className="ml-1 text-[11px] text-muted-foreground truncate">
              {risks.length} {risks.length === 1 ? 'finding' : 'findings'} pending review
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={loadRisks}
          disabled={loading}
          className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium text-muted-foreground bg-surface border border-border rounded hover:bg-muted transition-colors disabled:opacity-50"
          aria-label="Refresh risk queue"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {recentAction && (
        <div
          className={`px-4 sm:px-6 py-2.5 flex items-center gap-2 text-[12px] font-medium shrink-0 ${
            recentAction.type === 'confirmed'
              ? 'bg-green-50 text-green-800 border-b border-green-200'
              : 'bg-muted text-muted-foreground border-b border-border'
          }`}
        >
          <CheckCircle size={13} />
          {recentAction.type === 'confirmed'
            ? `Relationship confirmed for ${recentAction.label}. A ledger block was recorded.`
            : `Finding dismissed for ${recentAction.label}.`}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
        {loading && (
          <div className="space-y-4 max-w-3xl">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="bg-surface border border-border p-5 space-y-3">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-4 w-16" />
                <div className="space-y-2 pt-2">
                  {[...Array(4)].map((_, j) => (
                    <Skeleton key={j} className="h-2.5 w-full" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <TriangleAlert size={28} className="text-stone-300 mb-3" />
            <p className="text-[13px] font-medium text-foreground mb-1">Risk queue unavailable</p>
            <p className="text-[12px] text-muted-foreground">{error}</p>
          </div>
        )}

        {!loading && !error && risks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle size={28} className="text-stone-300 mb-3" />
            <p className="text-[14px] font-medium text-foreground">No findings pending review</p>
            <p className="text-[12px] text-muted-foreground mt-1 max-w-sm">
              All potential risks have been reviewed, or none have crossed the fusion threshold.
            </p>
          </div>
        )}

        {!loading && !error && risks.length > 0 && (
          <div className="space-y-4 max-w-3xl">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Findings are ranked by fused risk score. Weak signals from telecom, finance,
              co-location and case records are combined — a relationship may appear even when
              no single channel is conclusive.
            </p>

            {risks.map((risk) => (
              <RiskCard
                key={pairKey(risk.source_id, risk.target_id)}
                risk={risk}
                onConfirm={handleConfirm}
                onDismiss={handleDismiss}
                onViewInGraph={onViewInGraph}
                confirming={!!confirming[risk.edge_id]}
                dismissing={!!dismissing[risk.edge_id]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
