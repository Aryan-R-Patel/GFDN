import { database } from '../../firebase.js';
import { ref, onChildAdded, get } from 'firebase/database';
import { fileURLToPath } from 'url';

function prettyPrint(prefix, key, data) {
  console.log(`${new Date().toISOString()} - ${prefix} -> ${key}`);
  console.log(JSON.stringify(data, null, 2));
}

export default async function startWatcher(path = '/transactions', onNewTransaction = null) {
  const dbRef = ref(database, path);
  console.log(`Starting Firebase RTDB watcher on path: ${path}`);

  // Read existing keys to avoid re-printing them
  let snapshot;
  try {
    snapshot = await get(dbRef);
  } catch (err) {
    console.error('Failed to read initial snapshot:', err);
    throw err;
  }

  const existing = new Set();
  if (snapshot && snapshot.exists()) {
    const val = snapshot.val();
    for (const k of Object.keys(val || {})) existing.add(k);
  }

  console.log(`${new Date().toISOString()} - Initial snapshot processed (existing keys=${existing.size}).`);

  const unsubscribe = onChildAdded(dbRef, (childSnap) => {
    try {
      const key = childSnap.key;
      const value = childSnap.val();
      if (existing.has(key)) return; // skip existing
      prettyPrint('Added', key, value);
      existing.add(key);

      // Call the callback if provided (for workflow processing)
      if (onNewTransaction && typeof onNewTransaction === 'function') {
        onNewTransaction(value, key);
      }
    } catch (e) {
      console.error('Error handling child snapshot:', e);
    }
  }, (err) => {
    console.error('Realtime DB listener error:', err);
  });

  return () => {
    try { if (typeof unsubscribe === 'function') unsubscribe(); } catch (e) { console.warn('Failed to unsubscribe:', e); }
    console.log('Watcher stopped');
  };
}

// ESM-friendly direct-run check
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  const pathArg = process.argv[2] || '/transactions';
  startWatcher(pathArg).then((stop) => {
    process.on('SIGINT', () => {
      stop && stop();
      process.exit(0);
    });
  }).catch((err) => {
    console.error('Failed to start watcher:', err);
    process.exit(1);
  });
}
