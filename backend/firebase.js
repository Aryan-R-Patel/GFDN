import dotenv from 'dotenv';
dotenv.config();

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get } from 'firebase/database';

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

export { app, database, fetchAll };