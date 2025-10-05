// import GlobeView from '../components/GlobeView.jsx';
// import TransactionFeed from '../components/TransactionFeed.jsx';
// import DashboardMetrics from '../components/DashboardMetrics.jsx';
// import AIAssistant from '../components/AIAssistant.jsx';

// export default function Dashboard({ metrics, transactions, suggestions, onNavigateToWorkflow }) {
//   return (
//     <>
//       <header className="app__header">
//         <div>
//           <h1>Global Fraud Defense Network</h1>
//           <p className="app__subtitle">Visual, real-time fraud defense with AI-guided workflows.</p>
//         </div>
//         <div className="app__header-actions">
//           <DashboardMetrics metrics={metrics} />
//           <button className="workflow-nav-button" onClick={onNavigateToWorkflow}>
//             <span className="workflow-nav-button__icon">⚙️</span>
//             Edit Workflow
//           </button>
//         </div>
//       </header>
//       <main className="app__main">
//         <section className="app__main-left">
//           <GlobeView transactions={transactions} />
//           <TransactionFeed transactions={transactions} />
//         </section>
//         <section className="app__main-right">
//           <AIAssistant suggestions={suggestions} />
//         </section>
//       </main>
//     </>
//   );
// }
