import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Your real project config:
const firebaseConfig = {
  apiKey: "AIzaSyCgPqt8Iy9gL8akts7Sk12G5rGmUS71Vfg",
  authDomain: "hack-the-valley-x.firebaseapp.com",
  databaseURL: "https://hack-the-valley-x-default-rtdb.firebaseio.com",
  projectId: "hack-the-valley-x",
  storageBucket: "hack-the-valley-x.firebasestorage.app",
  messagingSenderId: "182567476349",
  appId: "1:182567476349:web:70e6f1632a159a5d9f6514",
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
