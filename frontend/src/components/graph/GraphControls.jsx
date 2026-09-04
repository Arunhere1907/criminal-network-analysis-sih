import { Maximize2, ZoomIn, ZoomOut, RotateCcw, Tag, TriangleAlert, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';

function ControlButton({ onClick, icon: Icon, title, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={cn(
        'w-8 h-8 flex items-center justify-center rounded transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-surface text-muted-foreground hover:text-foreground hover:bg-muted border border-border'
      )}
    >
      <Icon size={14} strokeWidth={1.75} />
    </button>
  );
}

const ROLES = [
  { value: 'all', label: 'All roles' },
  { value: 'financier', label: 'Financier' },
  { value: 'courier', label: 'Courier' },
  { value: 'peddler', label: 'Peddler' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'associate', label: 'Associate' },
  { value: 'contact', label: 'Contact' },
];

const EDGES = [
  { value: 'all', label: 'All links' },
  { value: 'comm_edge', label: 'Communication' },
  { value: 'financial_edge', label: 'Financial' },
  { value: 'location_edge', label: 'Co-location' },
  { value: 'case_edge', label: 'Case' },
  { value: 'potential_risk', label: 'Potential risk' },
];

export default function GraphControls({
  cy,
  showLabels,
  onToggleLabels,
  showRisk,
  onToggleRisk,
  roleFilter,
  onRoleFilter,
  edgeFilter,
  onEdgeFilter,
  onReload,
}) {
  const handleFit = () => cy?.fit(undefined, 40);
  const handleZoomIn = () => {
    if (!cy) return;
    cy.zoom({ level: cy.zoom() * 1.25, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
  };
  const handleZoomOut = () => {
    if (!cy) return;
    cy.zoom({ level: cy.zoom() * 0.8, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
  };
  const handleReset = () => {
    if (!cy) return;
    cy.fit(undefined, 40);
    cy.elements().removeClass('faded highlighted');
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap justify-end">
      <select
        value={roleFilter}
        onChange={(e) => onRoleFilter(e.target.value)}
        className="h-8 px-2 text-[11px] border border-border rounded bg-surface text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Filter by role"
      >
        {ROLES.map((r) => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>

      <select
        value={edgeFilter}
        onChange={(e) => onEdgeFilter(e.target.value)}
        className="h-8 px-2 text-[11px] border border-border rounded bg-surface text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Filter by relationship type"
      >
        {EDGES.map((r) => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>

      <div className="flex items-center gap-1 bg-surface border border-border rounded p-0.5">
        <ControlButton onClick={handleFit} icon={Maximize2} title="Fit graph" />
        <ControlButton onClick={handleZoomIn} icon={ZoomIn} title="Zoom in" />
        <ControlButton onClick={handleZoomOut} icon={ZoomOut} title="Zoom out" />
        <ControlButton onClick={handleReset} icon={RotateCcw} title="Reset view" />
        {onReload && <ControlButton onClick={onReload} icon={RefreshCw} title="Reload graph" />}
      </div>

      <div className="flex items-center gap-1 bg-surface border border-border rounded p-0.5">
        <ControlButton
          onClick={onToggleLabels}
          icon={Tag}
          title={showLabels ? 'Hide labels' : 'Show labels'}
          active={showLabels}
        />
        <ControlButton
          onClick={onToggleRisk}
          icon={TriangleAlert}
          title={showRisk ? 'Risk highlighting on' : 'Highlight potential risk'}
          active={showRisk}
        />
      </div>
    </div>
  );
}
