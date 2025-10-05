import WorkflowEditor from "../components/WorkflowEditor.jsx";

export default function WorkflowPage({ workflow, onBack }) {
  return (
    <>
      {/* globals in this file */}
      <style>{`
        html, body { margin: 0; }
        body { overflow-x: hidden; }
      `}</style>

      <header className="app__header">
        <div className="workflow-header">
          <button className="back-button" onClick={onBack}>
            <span className="back-button__icon">←</span>
            Back to Dashboard
          </button>
          <div>
            <h1>Workflow Editor</h1>
            <p className="app__subtitle">
              Configure your fraud detection workflow.
            </p>
          </div>
        </div>
      </header>

      {/* <main
        className="app__main app__main--workflow"
        style={{ width: "100%", padding: "20px" }}
      >
        <section
          className="workflow-page"
          style={{ backgroundColor: "red", width: "100%", padding: "10px" }}
        >
          <WorkflowEditor workflow={workflow} />
        </section>
      </main> */}
      <main className="app__main app__main--workflow" style={{ padding: 0 }}>
        <section
          className="workflow-page"
          style={{
            width: "100vw",
            position: "relative",
            left: "50%",
            transform: "translateX(-50vw)",
            boxSizing: "border-box",
            padding: "10px",
          }}
        >
          <WorkflowEditor workflow={workflow} />
        </section>
      </main>
    </>
  );
}
