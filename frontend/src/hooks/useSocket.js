import { useEffect } from 'react';
import { io } from 'socket.io-client';
import useGfdnStore from '../store/useGfdnStore.js';

const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
let socket;

export function useSocketConnection() {
  const setWorkflow = useGfdnStore((state) => state.setWorkflow);
  const setMetrics = useGfdnStore((state) => state.setMetrics);
  const setSuggestions = useGfdnStore((state) => state.setSuggestions);
  const addTransaction = useGfdnStore((state) => state.addTransaction);
  const prependTransactions = useGfdnStore((state) => state.prependTransactions);

  useEffect(() => {
    if (!socket) {
      socket = io(backendUrl, { transports: ['websocket'] });
    }

    socket.on('workflow:update', setWorkflow);
    socket.on('metrics:update', setMetrics);
    socket.on('suggestions:update', setSuggestions);
    socket.on('transaction:new', addTransaction);
    socket.on('transaction:seed', prependTransactions);

    return () => {
      socket.off('workflow:update', setWorkflow);
      socket.off('metrics:update', setMetrics);
      socket.off('suggestions:update', setSuggestions);
      socket.off('transaction:new', addTransaction);
      socket.off('transaction:seed', prependTransactions);
    };
  }, [setWorkflow, setMetrics, setSuggestions, addTransaction, prependTransactions]);

  return socket;
}
