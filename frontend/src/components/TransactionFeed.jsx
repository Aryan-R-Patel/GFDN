import dayjs from 'dayjs';

const decisionBadges = {
  APPROVE: 'badge badge--approve',
  FLAG: 'badge badge--flag',
  BLOCK: 'badge badge--block',
  CONTINUE: 'badge badge--continue',
};

export default function TransactionFeed({ transactions = [] }) {
  const feedItems = transactions.filter((item) => item && item.transaction);

  return (
    <div className="panel panel--feed">
      <div className="panel__header">
        <h2>Live Activity</h2>
        <p>Latest 25 transactions</p>
      </div>
      <div className="feed">
        {feedItems.slice(0, 25).map((item) => {
          const status = item.decision?.status || 'CONTINUE';
          const badgeClass = decisionBadges[status] || 'badge';
          const transaction = item.transaction || {};
          const amount = typeof transaction.amount === 'number' ? transaction.amount : 0;
          const currency = transaction.currency || '';
          const paymentMethod = transaction.metadata?.paymentMethod || transaction.payment_method || '—';
          const origin = transaction.origin || {};
          const destination = transaction.destination || {};
          const timestamp = transaction.timestamp ? dayjs(transaction.timestamp) : null;
          const historyTrail = Array.isArray(item.history) && item.history.length > 0
            ? item.history.map((node) => `${node.label || node.type}: ${node.status}`).join(' → ')
            : 'Awaiting workflow execution';

          return (
            <article key={item.id} className="feed__item">
              <header>
                <span className={badgeClass}>{status}</span>
                <h3>
                  ${amount.toLocaleString()} {currency}{' '}
                  <span className="muted">• {paymentMethod}</span>
                </h3>
              </header>
              <p>
                {origin.country || '??'} → {destination.country || '??'}{' '}
                <span className="muted">
                  ({origin.region || 'Unknown'} → {destination.region || 'Unknown'})
                </span>
              </p>
              <p className="muted">
                {timestamp ? timestamp.format('MMM D HH:mm:ss') : 'Unknown time'} • Latency{' '}
                {typeof item.latency === 'number' ? `${item.latency} ms` : '—'}
              </p>
              <footer>
                <small>{historyTrail}</small>
              </footer>
            </article>
          );
        })}
      </div>
    </div>
  );
}
