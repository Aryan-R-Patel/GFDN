import { fetchAll } from '../../firebase.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

async function main() {
  console.log('Fetching transactions from Firebase Realtime Database...');
  try {
    const data = await fetchAll('/transactions');
    if (!data) {
      console.log('No data found at /transactions.');
      return;
    }

    // Pretty-print the retrieved JSON
    console.log('--- Retrieved data ---');
    console.log(JSON.stringify(data, null, 2));
    console.log('--- End ---');
  } catch (err) {
    console.error('Error fetching data from Firebase:', err.message || err);
  }
}

// ESM-compatible direct-run check
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
if (process.argv[1] === __filename) {
  main();
}

export default main;
