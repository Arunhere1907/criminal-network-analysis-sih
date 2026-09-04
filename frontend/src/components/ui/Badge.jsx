import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-sm border',
  {
    variants: {
      variant: {
        default: 'bg-slate-100 text-slate-700 border-slate-200',
        peddler: 'bg-red-50 text-red-700 border-red-200',
        supplier: 'bg-orange-50 text-orange-700 border-orange-200',
        courier: 'bg-amber-50 text-amber-700 border-amber-200',
        financier: 'bg-slate-100 text-slate-800 border-slate-300',
        associate: 'bg-blue-50 text-blue-700 border-blue-200',
        contact: 'bg-slate-50 text-slate-600 border-slate-200',
        success: 'bg-green-50 text-green-700 border-green-200',
        neutral: 'bg-slate-100 text-slate-600 border-slate-200',
        comm: 'bg-blue-50 text-blue-700 border-blue-200',
        financial: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export function Badge({ variant, className, children, ...props }) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {children}
    </span>
  );
}

export function RoleBadge({ role }) {
  const roleMap = {
    peddler: 'peddler',
    supplier: 'supplier',
    courier: 'courier',
    financier: 'financier',
    associate: 'associate',
    contact: 'contact',
  };
  const variant = roleMap[role?.toLowerCase()] || 'default';
  const label = role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Unknown';
  return <Badge variant={variant}>{label}</Badge>;
}

export function ActionBadge({ action }) {
  const map = {
    risk_flag_confirmed: { variant: 'success', label: 'Risk Confirmed' },
    risk_flag_dismissed: { variant: 'neutral', label: 'Risk Dismissed' },
    node_created: { variant: 'comm', label: 'Node Created' },
    edge_created: { variant: 'comm', label: 'Edge Created' },
    merge_confirmed: { variant: 'financial', label: 'Merge Confirmed' },
  };
  const entry = map[action] || { variant: 'default', label: action || 'Action' };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}
