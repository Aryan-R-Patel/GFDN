import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import useGfdnStore from "../../store/useGfdnStore.js";
import { useSocketConnection } from "../../hooks/useSocket.js";
import AppView from "../views/AppView.jsx";
import WorkflowPage from "../../pages/WorkflowPage.jsx";
import AdminPage from "../../pages/AdminPage.jsx";

// Presenter: coordinates models (store + socket) and passes plain props to the view.
export default function AppPresenter() {
  const fetchInitialData = useGfdnStore(state => state.fetchInitialData);
  const metrics = useGfdnStore(state => state.metrics);
  const transactions = useGfdnStore(state => state.transactions);
  const workflow = useGfdnStore(state => state.workflow);
  const suggestions = useGfdnStore(state => state.suggestions);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // initialize socket listeners (they update the store directly)
  useSocketConnection();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await fetchInitialData();
      } catch (error) {
        // Presenter can decide how to surface errors later; for now log
        // and let the view show fallback UI based on `loading` / store state.
        // keep minimal behavioral change.
        // eslint-disable-next-line no-console
        console.error("Failed to fetch initial data", error);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [fetchInitialData]);
  const loadingScreen = (
    <div className="app app--loading">
      <div className="loading-card">
        <h1>Global Fraud Defense Network</h1>
        <p>Bootstrapping your personalized fraud cockpit…</p>
      </div>
    </div>
  );

  return (
    <Routes>
      <Route
        path="/"
        element={
          <AppView
            loading={loading}
            metrics={metrics}
            transactions={transactions}
            suggestions={suggestions}
            onNavigateToWorkflow={() => navigate('/workflow')}
            onNavigateToAdmin={() => navigate('/admin')}
          />
        }
      />
      <Route
        path="/workflow"
        element={
          loading
            ? loadingScreen
            : (
              <div className="app">
                <WorkflowPage workflow={workflow} onBack={() => navigate('/')} />
              </div>
            )
        }
      />
      <Route
        path="/admin"
        element={<AdminPage onBack={() => navigate('/')} />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
