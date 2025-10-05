import { useEffect, useState } from "react";
import useGfdnStore from "../../store/useGfdnStore.js";
import { useSocketConnection } from "../../hooks/useSocket.js";
import AppView from "../views/AppView.jsx";

// Presenter: coordinates models (store + socket) and passes plain props to the view.
export default function AppPresenter() {
  const fetchInitialData = useGfdnStore(state => state.fetchInitialData);
  const metrics = useGfdnStore(state => state.metrics);
  const transactions = useGfdnStore(state => state.transactions);
  const workflow = useGfdnStore(state => state.workflow);
  const suggestions = useGfdnStore(state => state.suggestions);
  const [loading, setLoading] = useState(true);

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

  return (
    <AppView
      loading={loading}
      metrics={metrics}
      transactions={transactions}
      workflow={workflow}
      suggestions={suggestions}
    />
  );
}
