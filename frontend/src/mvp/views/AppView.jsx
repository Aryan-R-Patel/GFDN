import { useState, useEffect, useCallback } from "react";
import GlobeView from "../../components/GlobeView.jsx";
import DashboardMetrics from "../../components/DashboardMetrics.jsx";
import AIAssistant from "../../components/AIAssistant.jsx";
import WorkflowPage from "../../pages/WorkflowPage.jsx";
import LoginPage from "../../pages/LoginPage.jsx";
import { auth } from "../../lib/firebase.js";
import { onAuthStateChanged, signOut } from "firebase/auth";

export default function AppView({
  loading,
  metrics,
  transactions,
  workflow,
  suggestions,
  currentPage,
  onNavigateToWorkflow,
  onNavigateToDashboard,
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatWidth, setChatWidth] = useState(380);
  const [isResizing, setIsResizing] = useState(false);

  // ---- auth gate ----
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  const logout = useCallback(() => signOut(auth), []);

  const handleMouseMove = useCallback(
    (e) => {
      if (!isResizing) return;
      e.preventDefault();
      const newWidth = window.innerWidth - e.clientX;
      setChatWidth(Math.min(Math.max(300, newWidth), 600));
    },
    [isResizing]
  );

  const handleMouseUp = useCallback(() => setIsResizing(false), []);
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // loading states
  if (loading || authLoading) {
    return (
      <div className="app app--loading">
        <div className="loading-card">
          <h1>Global Fraud Defense Network</h1>
          <p>Bootstrapping your personalized fraud cockpit…</p>
        </div>
      </div>
    );
  }

  // not signed in
  if (!user) {
    return <LoginPage redirectTo="/" />;
  }

  // workflow page
  if (currentPage === "workflow") {
    return (
      <div className="app">
        <WorkflowPage workflow={workflow} onBack={onNavigateToDashboard} />
      </div>
    );
  }

  // main app (signed in)
  return (
    <div className="app">
      {/* background globe */}
      <div className="app__background" aria-hidden="true">
        <GlobeView transactions={transactions} />
      </div>

      {/* overlay */}
      <div className="app__content">
        <header className="app__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {/* left: title (not clickable) */}
          <div style={{ pointerEvents: "none" }}>
            <h1>Global Fraud Defense Network</h1>
            <p className="app__subtitle">Visual, real-time fraud defense with AI-guided workflows.</p>
          </div>

          {/* right: actions (clickable) */}
          <div style={{ display: "flex", gap: 8, pointerEvents: "auto" }}>
            <button onClick={onNavigateToWorkflow} className="btn" style={{ padding: "8px 12px", borderRadius: 10 }}>
              Workflow
            </button>
            <button onClick={logout} className="btn" style={{ padding: "8px 12px", borderRadius: 10, background: "#ef4444", color: "#fff" }}>
              Logout
            </button>
          </div>
        </header>

        <main className="app__main-centered" style={{ pointerEvents: "none" }}>
          <div className="metrics-container">
            <DashboardMetrics metrics={metrics} />
          </div>

          <aside
            className={`chat-drawer ${chatOpen ? "chat-drawer--open" : ""}`}
            aria-hidden={!chatOpen}
            style={{
              width: chatWidth + "px",
              transform: chatOpen ? "translateX(0)" : `translateX(${chatWidth}px)`,
              pointerEvents: chatOpen ? "auto" : "none",
            }}
          >
            <div
              className="chat-drawer__resize-handle"
              onMouseDown={handleMouseDown}
              style={{ cursor: isResizing ? "col-resize" : "ew-resize", pointerEvents: "auto" }}
            />
            <div className="chat-drawer__header">
              <h3>Assistant Chat</h3>
              <button className="chat-drawer__close" onClick={() => setChatOpen(false)} aria-label="Close chat">
                ✕
              </button>
            </div>
            <div className="chat-drawer__body">
              <AIAssistant suggestions={suggestions} />
            </div>
          </aside>

          {!chatOpen && (
            <button
              className="chat-toggle-arrow"
              onClick={() => setChatOpen(true)}
              aria-expanded={chatOpen}
              aria-controls="chat-drawer"
              style={{ pointerEvents: "auto" }}
            >
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
              </svg>
            </button>
          )}
        </main>
      </div>
    </div>
  );
}
