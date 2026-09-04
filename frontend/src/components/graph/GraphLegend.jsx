import { X } from 'lucide-react';

const ROLES = [
  { key: 'peddler', label: 'Peddler', color: '#9F1239' },
  { key: 'supplier', label: 'Supplier', color: '#9A3412' },
  { key: 'courier', label: 'Courier', color: '#92400E' },
  { key: 'financier', label: 'Financier', color: '#1E3A5F' },
  { key: 'associate', label: 'Associate', color: '#334155' },
  { key: 'contact', label: 'Contact', color: '#78716C' },
];

const EDGE_TYPES = [
  { key: 'comm', label: 'Communication', style: 'solid', color: '#94A3B8' },
  { key: 'financial', label: 'Financial', style: 'solid', color: '#047857' },
  { key: 'location', label: 'Co-location', style: 'solid', color: '#B45309' },
  { key: 'case', label: 'Case Linkage', style: 'solid', color: '#9F1239' },
  { key: 'potential', label: 'Potential Risk', style: 'dashed', color: '#B45309' },
  { key: 'confirmed', label: 'Confirmed', style: 'solid', color: '#166534' },
];

export default function GraphLegend({ collapsed, onToggle }) {
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="bg-surface border border-border rounded px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-stone-300 transition-colors"
        title="Show legend"
      >
        Legend
      </button>
    );
  }

  return (
    <div className="bg-surface/95 backdrop-blur-sm border border-border rounded p-3 text-[11px] min-w-[148px] max-w-[180px]">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
          Legend
        </span>
        <button
          type="button"
          onClick={onToggle}
          className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
          title="Collapse legend"
          aria-label="Collapse legend"
        >
          <X size={12} />
        </button>
      </div>

      <div className="mb-3">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
          Roles
        </div>
        <div className="space-y-1.5">
          {ROLES.map(({ key, label, color }) => (
            <div key={key} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="text-foreground/80">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
          Relationships
        </div>
        <div className="space-y-1.5">
          {EDGE_TYPES.map(({ key, label, style, color }) => (
            <div key={key} className="flex items-center gap-2">
              <svg width="20" height="8" className="shrink-0" aria-hidden>
                <line
                  x1="0"
                  y1="4"
                  x2="20"
                  y2="4"
                  stroke={color}
                  strokeWidth="1.5"
                  strokeDasharray={style === 'dashed' ? '3,2' : undefined}
                />
              </svg>
              <span className="text-foreground/80">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
