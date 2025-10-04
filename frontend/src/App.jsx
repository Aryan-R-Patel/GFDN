import { useEffect, useState } from 'react';
import useGfdnStore from './store/useGfdnStore.js';
import { useSocketConnection } from './hooks/useSocket.js';
import GlobeView from './components/GlobeView.jsx';
import WorkflowEditor from './components/WorkflowEditor.jsx';
import DashboardMetrics from './components/DashboardMetrics.jsx';
import TransactionFeed from './components/TransactionFeed.jsx';
import AIAssistant from './components/AIAssistant.jsx';

export default function App() {
  const fetchInitialData = useGfdnStore((state) => state.fetchInitialData);
  const metrics = useGfdnStore((state) => state.metrics);
  const transactions = useGfdnStore((state) => state.transactions);
  const workflow = useGfdnStore((state) => state.workflow);
  const suggestions = useGfdnStore((state) => state.suggestions);
  const [loading, setLoading] = useState(true);

  useSocketConnection();

  useEffect(() => {
    (async () => {
      try {
        await fetchInitialData();
      } catch (error) {
        console.error('Failed to fetch initial data', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchInitialData]);

  if (loading) {
    return (
      <div className="app app--loading">
        <div className="loading-card">
          <h1>Global Fraud Defense Network</h1>
          <p>Bootstrapping your personalized fraud cockpit…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1>Global Fraud Defense Network</h1>
          <p className="app__subtitle">Visual, real-time fraud defense with AI-guided workflows.</p>
        </div>
        <div className="app__header-stats">
          <DashboardMetrics metrics={metrics} />
        </div>
      </header>
      <main className="app__main">
        <section className="app__main-left">
          <GlobeView transactions={transactions} />
          <TransactionFeed transactions={transactions} />
        </section>
        <section className="app__main-right">
          <WorkflowEditor workflow={workflow} />
          <AIAssistant suggestions={suggestions} />
        </section>
      </main>
    </div>
  );
}
