import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load .env located next to this file (backend/.env) so scripts can run from any CWD
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dotEnvPath = resolve(__dirname, '.env');
dotenv.config({ path: dotEnvPath });

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, set, push, update } from 'firebase/database';

const FIREBASE_REALTIME_DB = process.env.FIREBASE_REALTIME_DB;

if (!FIREBASE_REALTIME_DB) {
  console.warn('FIREBASE_REALTIME_DB not set in environment. Realtime DB operations will likely fail.');
}

// Minimal Firebase config using databaseURL from env
const firebaseConfig = {
  databaseURL: FIREBASE_REALTIME_DB,
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

async function fetchAll(path = '/') {
  const dbRef = ref(database, path);
  const snap = await get(dbRef);
  return snap.exists() ? snap.val() : null;
}

async function writeData(path, data) {
  const dbRef = ref(database, path);
  await set(dbRef, data);
}

async function pushData(path, data) {
  const dbRef = ref(database, path);
  const newRef = await push(dbRef, data);
  return newRef.key;
}

async function updateData(path, data) {
  const dbRef = ref(database, path);
  await update(dbRef, data);
}

export { app, database, fetchAll, writeData, pushData, updateData };