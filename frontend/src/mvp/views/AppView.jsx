import { useState, useEffect, useCallback } from "react";
import GlobeView from "../../components/GlobeView.jsx";
import DashboardMetrics from "../../components/DashboardMetrics.jsx";
import AIAssistant from "../../components/AIAssistant.jsx";
import TransactionSummary from "../../components/TransactionSummary.jsx";

export default function AppView({
  loading,
  metrics,
  transactions,
  suggestions,
  onNavigateToWorkflow,
  onNavigateToAdmin,
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatWidth, setChatWidth] = useState(380);
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseMove = useCallback(
    e => {
      if (!isResizing) return;
      e.preventDefault();
      const newWidth = window.innerWidth - e.clientX;
      // Constrain width between 300 and 600 pixels
      setChatWidth(Math.min(Math.max(300, newWidth), 600));
    },
    [isResizing]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  const handleMouseDown = e => {
    // Only handle left mouse button
    if (e.button !== 0) return;
    e.preventDefault();
    setIsResizing(true);
  };

  // Set up and clean up event listeners
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
  if (loading) {
    return (
      <div className="app app--loading">
        <div className="loading-card">
          <h1>Global Fraud Defense Network</h1>
          <p>Bootstrapping your personalized fraud cockpit…</p>
        </div>
      </div>
    );
  }

  // Show workflow page if on workflow page
  return (


    <div className="app">

     {/* full-screen background globe */}
      <div className="app__background" aria-hidden="true">
        <GlobeView transactions={transactions} />
      </div>


      {/* overlay content sits above the globe */}
      <div className="app__content">
        <header className="app__header">
          <div style={{ pointerEvents: "none" }}>
            <h1>Global Fraud Defense Network</h1>
            <p className="app__subtitle">
              Visual, real-time fraud defense with AI-guided workflows.
            </p>
          </div>
          <div
            className="app__header-buttons"
            style={{ pointerEvents: "auto" }}
          >
            <button
              className="workflow-nav-button workflow-nav-button--ghost"
              onClick={onNavigateToAdmin}
            >
              <span className="workflow-nav-button__icon">🛠️</span>
              Admin Console
            </button>
            <button
              className="workflow-nav-button"
              onClick={onNavigateToWorkflow}
            >
              <span className="workflow-nav-button__icon">⚙️</span>
              Edit Workflow
            </button>
          </div>
        </header>

        <main className="app__main-centered" style={{ pointerEvents: "none" }}>

          <div className="summary-stack">
            <TransactionSummary transactions={transactions} />
          </div>

          <div className="metrics-container">
            <DashboardMetrics metrics={metrics} />
          </div>



          <aside
            className={`chat-drawer ${chatOpen ? "chat-drawer--open" : ""}`}
            aria-hidden={!chatOpen}
            style={{
              width: chatWidth + "px",
              transform: chatOpen
                ? "translateX(0)"
                : `translateX(${chatWidth}px)`,
              pointerEvents: chatOpen ? "auto" : "none",
            }}
          >
            <div
              className="chat-drawer__resize-handle"
              onMouseDown={handleMouseDown}
              style={{
                cursor: isResizing ? "col-resize" : "ew-resize",
                pointerEvents: "auto",
            }}
            />
            <div className="chat-drawer__header">
              <h3>Assistant Chat</h3>
              <button
                className="chat-drawer__close"
                onClick={() => setChatOpen(false)}
                aria-label="Close chat"
              >
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
              <svg
                viewBox="0 0 24 24"
                width="24"
                height="24"
                fill="currentColor"
              >
                <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
              </svg>
            </button>
          )}
        </main>
      </div>
    </div>

  );
}