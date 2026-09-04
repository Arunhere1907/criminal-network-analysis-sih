import { useState } from 'react';
import { Network, TriangleAlert, UsersRound, ScrollText, Circle, Menu, X } from 'lucide-react';
import { cn } from '../../lib/utils';

const NAV_ITEMS = [
  { id: 'graph', label: 'Network Explorer', icon: Network },
  { id: 'risk', label: 'Potential Risk', icon: TriangleAlert },
  { id: 'communities', label: 'Communities', icon: UsersRound },
  { id: 'ledger', label: 'Audit Ledger', icon: ScrollText },
];

function NavContent({ activeTab, onTabChange, onNavigate }) {
  return (
    <>
      <div className="h-14 flex items-center px-4 border-b border-border shrink-0 gap-3">
        <span className="font-semibold text-[13px] tracking-[0.14em] text-foreground select-none">
          CNA
        </span>
        <span className="hidden xl:inline text-[11px] font-medium text-muted-foreground whitespace-nowrap truncate">
          Criminal Network Analysis
        </span>
      </div>

      <ul className="flex-1 py-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => {
                  onTabChange(id);
                  onNavigate?.();
                }}
                title={label}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'w-full flex items-center h-10 px-4 gap-3 text-left transition-colors duration-150',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                  isActive
                    ? 'bg-muted text-foreground border-l-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60 border-l-2 border-transparent'
                )}
              >
                <Icon
                  size={16}
                  strokeWidth={isActive ? 2 : 1.5}
                  className={cn('shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')}
                />
                <span
                  className={cn(
                    'text-[13px] font-medium whitespace-nowrap',
                    isActive ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="h-12 flex items-center px-4 border-t border-border gap-2 shrink-0">
        <Circle size={6} className="fill-success text-success shrink-0" aria-hidden />
        <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase whitespace-nowrap">
          System Operational
        </span>
      </div>
    </>
  );
}

export default function Sidebar({ activeTab, onTabChange, mobileOpen, onMobileClose }) {
  return (
    <>
      {/* Desktop rail */}
      <nav
        className="hidden md:flex flex-col h-full w-[13.5rem] bg-surface border-r border-border shrink-0 z-20"
        aria-label="Primary"
      >
        <NavContent activeTab={activeTab} onTabChange={onTabChange} />
      </nav>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <button
            type="button"
            className="absolute inset-0 bg-foreground/20"
            aria-label="Close navigation"
            onClick={onMobileClose}
          />
          <nav className="relative flex flex-col h-full w-64 bg-surface border-r border-border shadow-sm z-50">
            <div className="absolute top-3 right-3">
              <button
                type="button"
                onClick={onMobileClose}
                className="w-8 h-8 flex items-center justify-center rounded text-muted-foreground hover:bg-muted"
                aria-label="Close menu"
              >
                <X size={16} />
              </button>
            </div>
            <NavContent
              activeTab={activeTab}
              onTabChange={onTabChange}
              onNavigate={onMobileClose}
            />
          </nav>
        </div>
      )}
    </>
  );
}

export function MobileMenuButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="md:hidden w-8 h-8 flex items-center justify-center rounded border border-border text-muted-foreground hover:bg-muted"
      aria-label="Open navigation"
    >
      <Menu size={16} />
    </button>
  );
}
