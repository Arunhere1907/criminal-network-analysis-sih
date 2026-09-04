import { useState } from 'react';
import AppShell from './components/layout/AppShell';
import GraphExplorer from './components/graph/GraphExplorer';
import RiskQueue from './components/risk/RiskQueue';
import Communities from './components/communities/Communities';
import LedgerViewer from './components/ledger/LedgerViewer';

export default function App() {
  const [activeTab, setActiveTab] = useState('graph');
  const [graphFocus, setGraphFocus] = useState(null);

  const handleNavigateToGraph = (nodeIds) => {
    setGraphFocus(nodeIds ? { nodeIds, ts: Date.now() } : null);
    setActiveTab('graph');
  };

  return (
    <AppShell activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'graph' && (
        <GraphExplorer focusRequest={graphFocus} />
      )}
      {activeTab === 'risk' && (
        <RiskQueue onViewInGraph={handleNavigateToGraph} />
      )}
      {activeTab === 'communities' && (
        <Communities onViewInGraph={handleNavigateToGraph} />
      )}
      {activeTab === 'ledger' && <LedgerViewer />}
    </AppShell>
  );
}
