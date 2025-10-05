import { create } from 'zustand';

const isRealTransaction = (record) => {
  if (!record) return false;
  const topLevelSource = record.source;
  const nestedSource = record.transaction?.source;
  return topLevelSource !== 'simulated' && nestedSource !== 'simulated';
};

const filterRealTransactions = (records = []) => records.filter(isRealTransaction);

const useGfdnStore = create((set, get) => ({
  workflow: null,
  transactions: [],
  metrics: null,
  suggestions: [],
  isSavingWorkflow: false,
  setWorkflow: (workflow) => set({ workflow }),
  setTransactions: (transactions) => set({ transactions: filterRealTransactions(transactions) }),
  prependTransactions: (records) =>
    set((state) => {
      const incoming = filterRealTransactions(records);
      if (!incoming.length) {
        return { transactions: state.transactions };
      }
      const combined = [...incoming, ...state.transactions];
      const unique = Array.from(new Map(combined.map((txn) => [txn.id, txn])).values());
      return { transactions: unique.slice(0, 200) };
    }),
  addTransaction: (record) =>
    set((state) => {
      if (!isRealTransaction(record)) {
        return state;
      }
      const existingMap = new Map(state.transactions.map((txn) => [txn.id, txn]));
      existingMap.set(record.id, record);
      const ordered = [record, ...state.transactions.filter((txn) => txn.id !== record.id)];
      return { transactions: ordered.slice(0, 200) };
    }),
  setMetrics: (metrics) => set({ metrics }),
  setSuggestions: (suggestions) => set({ suggestions }),
  saveWorkflow: async (workflow) => {
    try {
      set({ isSavingWorkflow: true });
      const response = await fetch('/api/workflows/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workflow),
      });
      if (!response.ok) {
        throw new Error('Failed to save workflow');
      }
      const data = await response.json();
      set({ workflow: data.workflow });
    } catch (error) {
      console.error('Failed to save workflow', error);
      throw error;
    } finally {
      set({ isSavingWorkflow: false });
    }
  },
  fetchInitialData: async () => {
    const [workflowRes, metricsRes, transactionsRes, suggestionsRes] = await Promise.all([
      fetch('/api/workflows/active'),
      fetch('/api/metrics'),
      fetch('/api/transactions/live'),
      fetch('/api/suggestions'),
    ]);
    const [workflow, metrics, transactions, suggestions] = await Promise.all([
      workflowRes.json(),
      metricsRes.json(),
      transactionsRes.json(),
      suggestionsRes.json(),
    ]);
    set({ workflow, metrics, transactions, suggestions });
  },
}));

export default useGfdnStore;
