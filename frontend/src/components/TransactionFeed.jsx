import dayjs from 'dayjs';

const decisionBadges = {
  APPROVE: 'badge badge--approve',
  FLAG: 'badge badge--flag',
  BLOCK: 'badge badge--block',
};

export default function TransactionFeed({ transactions = [] }) {
  return (
    <div className="panel panel--feed">
      <div className="panel__header">
        <h2>Live Activity</h2>
        <p>Latest 25 transactions</p>
      </div>
      <div className="feed">
        {transactions.slice(0, 25).map((item) => (
          <article key={item.id} className="feed__item">
            <header>
              <span className={decisionBadges[item.decision.status] || 'badge'}>
                {item.decision.status}
              </span>
              <h3>
                ${item.transaction.amount.toLocaleString()} {item.transaction.currency}{' '}
                <span className="muted">• {item.transaction.metadata.paymentMethod}</span>
              </h3>
            </header>
            <p>
              {item.transaction.origin.country} → {item.transaction.destination.country}{' '}
              <span className="muted">({item.transaction.origin.region} → {item.transaction.destination.region})</span>
            </p>
            <p className="muted">
              {dayjs(item.transaction.timestamp).format('MMM D HH:mm:ss')} • Latency {item.latency} ms
            </p>
            <footer>
              <small>
                {item.history
                  .map((node) => `${node.label || node.type}: ${node.status}`)
                  .join(' → ')}
              </small>
            </footer>
          </article>
        ))}
      </div>
    </div>
  );
}
