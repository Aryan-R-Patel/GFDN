import WorkflowEditor from '../components/WorkflowEditor.jsx';

export default function WorkflowPage({ workflow, onBack }) {
  return (
    <>
      <header className="app__header">
        <div className="workflow-header">
          <button className="back-button" onClick={onBack}>
            <span className="back-button__icon">←</span>
            Back to Dashboard
          </button>
          <div>
            <h1>Workflow Editor</h1>
            <p className="app__subtitle">Configure your fraud detection workflow.</p>
          </div>
        </div>
      </header>
      <main className="app__main app__main--workflow">
        <section className="workflow-page">
          <WorkflowEditor workflow={workflow} />
        </section>
      </main>
    </>
  );
}
