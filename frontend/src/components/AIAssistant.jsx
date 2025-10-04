export default function AIAssistant({ suggestions = [] }) {
  return (
    <div className="panel panel--assistant">
      <div className="panel__header">
        <h2>AI Fraud Assistant</h2>
        <p className="muted">Insights, nudges, and workflow upgrades tailored to your stream.</p>
      </div>
      <div className="assistant">
        {suggestions.map((suggestion) => (
          <article key={suggestion.id} className={`assistant__card assistant__card--${suggestion.priority}`}>
            <header>
              <span className="badge">{suggestion.priority.toUpperCase()}</span>
              <h3>{suggestion.title}</h3>
            </header>
            <p>{suggestion.body}</p>
            {suggestion.action?.type === 'WORKFLOW_HINT' && (
              <footer>
                <small className="muted">
                  Suggested node: {suggestion.action.data.nodeType} • Try config {JSON.stringify(
                    suggestion.action.data.recommendedConfig,
                  )}
                </small>
              </footer>
            )}
          </article>
        ))}
        {suggestions.length === 0 && <p>No insights yet. Streaming data will unlock guidance shortly.</p>}
      </div>
    </div>
  );
}
