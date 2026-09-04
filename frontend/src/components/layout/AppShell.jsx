import { useState } from 'react';
import Sidebar, { MobileMenuButton } from './Sidebar';

export default function AppShell({ activeTab, onTabChange, children }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen bg-background overflow-hidden font-sans">
      <Sidebar
        activeTab={activeTab}
        onTabChange={onTabChange}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex-1 min-w-0 h-full flex flex-col overflow-hidden relative">
        {/* Compact mobile top strip */}
        <div className="md:hidden flex items-center gap-3 h-11 px-3 bg-surface border-b border-border shrink-0">
          <MobileMenuButton onClick={() => setMobileOpen(true)} />
          <span className="text-[12px] font-semibold tracking-[0.12em] text-foreground">CNA</span>
          <span className="text-[11px] text-muted-foreground ml-auto">Investigator</span>
        </div>
        <main className="flex-1 min-h-0 overflow-hidden relative">{children}</main>
      </div>
    </div>
  );
}
