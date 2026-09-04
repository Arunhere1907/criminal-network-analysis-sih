import { useState } from 'react';
import { Check, X, ChevronDown, ChevronUp, ArrowRight, Network } from 'lucide-react';
import { RoleBadge } from '../ui/Badge';
import EvidenceBreakdown from './EvidenceBreakdown';
import { cn, formatScore } from '../../lib/utils';

function RiskScoreBadge({ score }) {
  const level = score >= 0.75 ? 'high' : score >= 0.55 ? 'medium' : 'low';
  const styles = {
    high: 'bg-red-50 text-red-800 border-red-200',
    medium: 'bg-amber-50 text-amber-900 border-amber-200',
    low: 'bg-muted text-muted-foreground border-border',
  };
  const labels = { high: 'HIGH', medium: 'ELEVATED', low: 'LOW' };
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[22px] font-semibold font-mono text-foreground leading-none tracking-tight">
        {formatScore(score)}
      </span>
      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-sm border', styles[level])}>
        {labels[level]}
      </span>
    </div>
  );
}

export default function RiskCard({
  risk,
  onConfirm,
  onDismiss,
  onViewInGraph,
  confirming,
  dismissing,
}) {
  const [evidenceOpen, setEvidenceOpen] = useState(true);
  const [confirmPending, setConfirmPending] = useState(false);

  const sourceName = (risk.source_names || [])[0] || risk.source_id;
  const targetName = (risk.target_names || [])[0] || risk.target_id;
  const sourceRole = risk.source_role || 'contact';
  const targetRole = risk.target_role || 'contact';
  const isSilentPattern =
    sourceRole === 'financier' ||
    targetRole === 'financier' ||
    sourceRole === 'courier' ||
    targetRole === 'courier';

  return (
    <article className="bg-surface border border-border overflow-hidden">
      <div className="px-5 pt-5 pb-4 border-b border-border">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
            Potential Relationship
          </div>
          {isSilentPattern && (
            <span className="text-[10px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-sm">
              Multi-signal fusion
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="min-w-0 flex-1 text-left">
            <div className="text-[14px] font-semibold text-foreground truncate mb-1.5">
              {sourceName}
            </div>
            <RoleBadge role={sourceRole} />
          </div>
          <div className="flex flex-col items-center gap-1 shrink-0 px-1">
            <div className="w-12 sm:w-16 h-px bg-border" />
            <ArrowRight size={12} className="text-muted-foreground" />
            <div className="w-12 sm:w-16 h-px bg-border" />
          </div>
          <div className="min-w-0 flex-1 text-right">
            <div className="text-[14px] font-semibold text-foreground truncate mb-1.5">
              {targetName}
            </div>
            <div className="flex justify-end">
              <RoleBadge role={targetRole} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono mb-4">
          <span>{risk.source_id}</span>
          <span className="text-stone-300">—</span>
          <span>{risk.target_id}</span>
          {(risk.edge_ids?.length || 1) > 1 && (
            <span className="ml-auto font-sans text-muted-foreground">
              {risk.edge_ids.length} evidence edges
            </span>
          )}
        </div>

        <div>
          <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-1.5">
            Risk score
          </div>
          <RiskScoreBadge score={risk.risk_score || 0} />
        </div>
      </div>

      <div className="px-5 py-4 border-b border-border">
        <button
          type="button"
          onClick={() => setEvidenceOpen((v) => !v)}
          className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground uppercase tracking-wider mb-3"
        >
          {evidenceOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          Evidence
        </button>
        {evidenceOpen && (
          <EvidenceBreakdown
            evidence={risk.evidence || []}
            riskScore={risk.risk_score || 0}
          />
        )}
      </div>

      <div className="px-5 py-3 flex flex-wrap items-center gap-2 bg-muted/40">
        {confirmPending ? (
          <>
            <span className="text-[12px] text-muted-foreground mr-auto">
              Confirm this relationship? Action is written to the audit ledger.
            </span>
            <button
              type="button"
              onClick={() => setConfirmPending(false)}
              className="h-8 px-3 text-[12px] font-medium text-muted-foreground bg-surface border border-border rounded hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onConfirm(risk);
                setConfirmPending(false);
              }}
              disabled={confirming}
              className="h-8 px-4 text-[12px] font-semibold text-white bg-success rounded hover:bg-green-800 disabled:opacity-50 flex items-center gap-1.5"
            >
              <Check size={12} />
              {confirming ? 'Confirming…' : 'Confirm Relationship'}
            </button>
          </>
        ) : (
          <>
            {onViewInGraph && (
              <button
                type="button"
                onClick={() => onViewInGraph([risk.source_id, risk.target_id])}
                className="h-8 px-3 text-[12px] font-medium text-muted-foreground bg-surface border border-border rounded hover:bg-muted flex items-center gap-1.5 mr-auto"
              >
                <Network size={12} />
                View in graph
              </button>
            )}
            <button
              type="button"
              onClick={() => setConfirmPending(true)}
              disabled={confirming}
              className="h-8 px-4 text-[12px] font-semibold text-white bg-success rounded hover:bg-green-800 disabled:opacity-50 flex items-center gap-1.5"
            >
              <Check size={12} />
              Confirm
            </button>
            <button
              type="button"
              onClick={() => onDismiss(risk)}
              disabled={dismissing}
              className="h-8 px-4 text-[12px] font-medium text-muted-foreground bg-surface border border-border rounded hover:bg-red-50 hover:text-risk hover:border-red-200 disabled:opacity-50 flex items-center gap-1.5"
            >
              <X size={12} />
              {dismissing ? 'Dismissing…' : 'Dismiss'}
            </button>
          </>
        )}
      </div>
    </article>
  );
}
