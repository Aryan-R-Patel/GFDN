import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { auth } from "../lib/firebase";
import {
  GoogleAuthProvider, signInWithPopup,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  onAuthStateChanged
} from "firebase/auth";
import "./login.css"; // <-- add this

export default function LoginPage({ redirectTo = "/" }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [user, setUser] = useState(null);

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => { if (user) setTimeout(() => (window.location.href = redirectTo), 800); }, [user, redirectTo]);

  const size = useMemo(() => (typeof window !== "undefined" && window.innerWidth < 640 ? 68 : 78), []);
  const withUi = async (fn) => { try { setErr(""); setBusy(true); await fn(); } catch (e) { setErr(e?.message || "Error"); } finally { setBusy(false); } };
  const signEmail = () => withUi(() => mode === "signin"
    ? signInWithEmailAndPassword(auth, email, password)
    : createUserWithEmailAndPassword(auth, email, password));
  const signGoogle = () => withUi(() => signInWithPopup(auth, new GoogleAuthProvider()));

  return (
    <div className="gs-root">
      <div className="gs-aurora" />
      <div className="gs-scanlines" />
      <motion.div className="gs-card-wrap" initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <div className="gs-card">
          <div className="gs-card-header">
            <div className="gs-badge" aria-hidden />
            <div className="gs-header-text">
              <h1>Global Fraud Defense Network</h1>
              <p>Visual, real-time fraud defense with AI-guided workflows.</p>
            </div>
          </div>

          <div className="gs-body">
            <p className="gs-subtle">{mode === "signin" ? "Authenticate to continue" : "Create a verified account"}</p>

            <label className="gs-field">
              <span className="gs-label">Email</span>
              <input className="gs-input" placeholder="you@company.com" type="email"
                     value={email} onChange={(e)=>setEmail(e.target.value)} />
            </label>

            <label className="gs-field">
              <span className="gs-label">Password</span>
              <input className="gs-input" placeholder="Password" type="password"
                     value={password} onChange={(e)=>setPassword(e.target.value)} />
            </label>

            <button className="gs-btn gs-btn-primary" onClick={signEmail} disabled={busy}>
              {busy ? "Verifying…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>

            <button className="gs-btn gs-btn-ghost" onClick={signGoogle} disabled={busy}>
              Continue with Google
            </button>

            <div className="gs-row">
              <span className="gs-subtle">MFA supported</span>
              <a className="gs-link" href="#">Forgot password?</a>
            </div>

            <div className="gs-center gs-subtle">
              {mode === "signin" ? (
                <>New here? <button className="gs-link" onClick={()=>setMode("signup")}>Create an account</button></>
              ) : (
                <>Have an account? <button className="gs-link" onClick={()=>setMode("signin")}>Sign in</button></>
              )}
            </div>

            {err && <p className="gs-error">{err}</p>}
          </div>

          <div className="gs-footer">
            <span>© {new Date().getFullYear()} Global Secure Network</span>
            <div className="gs-links">
              <a href="#" className="gs-link">Privacy</a>
              <a href="#" className="gs-link">Terms</a>
              <a href="#" className="gs-link">Status</a>
            </div>
          </div>

          <div className="gs-watermark">GLOBAL • SECURITY</div>
        </div>
      </motion.div>

      <motion.div
        initial={false}
        animate={user ? { y: 0, scale: 1 } : { y: `${size/2}vmin`, scale: 1 }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
        style={{ width: `${size}vmin`, height: `${size}vmin` }}
        className="gs-globe"
        aria-hidden
      >
        <div className="gs-globe-core" />
        <div className="gs-globe-shade" />
      </motion.div>

      <div className="gs-ground-fade" />
    </div>
  );
}
