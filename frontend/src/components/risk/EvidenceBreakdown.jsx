import { cn, getSignalLabel, FUSION_WEIGHTS } from '../../lib/utils';

const SIGNAL_CONFIGS = [
  { key: 'communication', label: 'Communication', color: '#64748B' },
  { key: 'co-location', label: 'Co-location', color: '#B45309' },
  { key: 'financial', label: 'Financial', color: '#047857' },
  { key: 'case linkage', label: 'Case Linkage', color: '#B91C1C' },
];

function parseEvidence(evidence) {
  if (!evidence) return [];
  return evidence
    .map((ev) => {
      if (typeof ev === 'string') {
        try {
          return JSON.parse(ev);
        } catch {
          return { type: ev, contribution: 0 };
        }
      }
      return ev;
    })
    .filter(Boolean);
}

/**
 * Derive fused contribution display from raw evidence items.
 * Aligns with backend FusionScorer weights.
 */
function deriveSignals(evidence) {
  const items = parseEvidence(evidence);
  const counts = {};
  const raw = {};

  items.forEach((ev) => {
    const label = getSignalLabel(ev.type || ev.edge_type).toLowerCase();
    counts[label] = (counts[label] || 0) + 1;
    raw[label] = (raw[label] || 0) + (Number(ev.contribution) || 0.1);
  });

  const contributions = {};
  SIGNAL_CONFIGS.forEach(({ key }) => {
    const weight = FUSION_WEIGHTS[key] || 0;
    const signal = Math.min(1, raw[key] || 0);
    if (!counts[key]) {
      contributions[key] = 0;
    } else {
      contributions[key] = weight * (signal || 1);
    }
  });

  return { contributions, counts };
}

export default function EvidenceBreakdown({ evidence, riskScore }) {
  const { contributions, counts } = deriveSignals(evidence);
  const total =
    riskScore ||
    Object.values(contributions).reduce((a, b) => a + b, 0);

  const commValue = contributions.communication || 0;
  const colocationValue = contributions['co-location'] || 0;
  const financialValue = contributions.financial || 0;
  const caseValue = contributions['case linkage'] || 0;

  return (
    <div>
      <div className="mb-3">
        <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-2">
          Why this relationship was flagged
        </p>
        <div className="space-y-1.5">
          {commValue === 0 && (
            <div className="flex items-center gap-2 text-[12px]">
              <span className="w-1.5 h-1.5 rounded-full bg-stone-300 shrink-0" />
              <span className="text-muted-foreground">No direct communication detected</span>
            </div>
          )}
          {commValue > 0 && (
            <div className="flex items-center gap-2 text-[12px]">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" />
              <span className="text-foreground">
                {counts.communication} communication record
                {counts.communication > 1 ? 's' : ''}
              </span>
            </div>
          )}
          {colocationValue > 0 && (
            <div className="flex items-center gap-2 text-[12px]">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0" />
              <span className="text-foreground">
                {counts['co-location']} co-location event
                {counts['co-location'] > 1 ? 's' : ''}
              </span>
            </div>
          )}
          {financialValue > 0 && (
            <div className="flex items-center gap-2 text-[12px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-700 shrink-0" />
              <span className="text-foreground">
                {counts.financial} financial transaction
                {counts.financial > 1 ? 's' : ''}
              </span>
            </div>
          )}
          {caseValue > 0 ? (
            <div className="flex items-center gap-2 text-[12px]">
              <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0" />
              <span className="text-foreground">Case linkage present</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[12px]">
              <span className="w-1.5 h-1.5 rounded-full bg-stone-300 shrink-0" />
              <span className="text-muted-foreground">No direct case naming</span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2 pt-3 border-t border-border">
        <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-2">
          Evidence Contribution
        </p>
        {SIGNAL_CONFIGS.map(({ key, label, color }) => {
          const value = contributions[key] || 0;
          const max = FUSION_WEIGHTS[key] || 0.3;
          const barPct = Math.min(100, (value / max) * 100);
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground w-[104px] shrink-0">{label}</span>
              <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${barPct}%`,
                    backgroundColor: value === 0 ? '#E7E5E4' : color,
                  }}
                />
              </div>
              <span
                className={cn(
                  'text-[11px] font-mono w-9 text-right',
                  value === 0 ? 'text-stone-300' : 'text-foreground'
                )}
              >
                {value.toFixed(2)}
              </span>
            </div>
          );
        })}

        <div className="pt-2 border-t border-border flex items-center justify-between">
          <span className="text-[11px] font-semibold text-foreground">
            Combined evidence → Risk
          </span>
          <span className="text-[13px] font-mono font-bold text-foreground">
            {Number(total).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
