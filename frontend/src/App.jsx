import { useState } from 'react';
import GraphExplorer from './components/GraphExplorer';
import RiskQueue from './components/RiskQueue';
import Communities from './components/Communities';
import LedgerViewer from './components/LedgerViewer';

function App() {
  const [activeTab, setActiveTab] = useState('graph');

  return (
    <div className="app-container">
      <nav className="sidebar">
        <div className="sidebar-logo">CNA</div>
        <ul className="nav-links">
          <li className={activeTab === 'graph' ? 'active' : ''} onClick={() => setActiveTab('graph')}>
            <span className="icon">🌐</span>
            <span className="label">Graph Explorer</span>
          </li>
          <li className={activeTab === 'risk' ? 'active' : ''} onClick={() => setActiveTab('risk')}>
            <span className="icon">⚠️</span>
            <span className="label">Risk Queue</span>
          </li>
          <li className={activeTab === 'communities' ? 'active' : ''} onClick={() => setActiveTab('communities')}>
            <span className="icon">👥</span>
            <span className="label">Communities</span>
          </li>
          <li className={activeTab === 'ledger' ? 'active' : ''} onClick={() => setActiveTab('ledger')}>
            <span className="icon">📓</span>
            <span className="label">Ledger</span>
          </li>
        </ul>
      </nav>
      
      <main className="main-content">
        {activeTab === 'graph' && <GraphExplorer />}
        {activeTab === 'risk' && <RiskQueue />}
        {activeTab === 'communities' && <Communities />}
        {activeTab === 'ledger' && <LedgerViewer />}
      </main>
    </div>
  );
}

export default App;
