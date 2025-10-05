import dayjs from 'dayjs';

const statusClasses = {
  APPROVE: 'badge badge--approve',
  FLAG: 'badge badge--flag',
  BLOCK: 'badge badge--block',
  PENDING: 'badge badge--pending',
};

function formatAmount(amount, currency) {
  if (typeof amount !== 'number' || Number.isNaN(amount)) {
    return '—';
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${currency || ''}`.trim();
  }
}

function formatTimestamp(value) {
  if (!value) return 'Unknown time';
  const parsed = dayjs(value);
  if (!parsed.isValid()) return 'Unknown time';
  return parsed.format('MMM D • HH:mm:ss');
}

export default function TransactionSummary({ transactions = [] }) {
  const items = transactions.filter(Boolean).slice(0, 12);

  return (
    <section className="summary-panel" aria-label="Live transaction summaries">
      <header className="summary-panel__header">
        <h2>Live Decisions</h2>
        <p>Latest workflow outcomes</p>
      </header>

      {items.length === 0 ? (
        <div className="summary-panel__empty">
          <p>No transactions yet. Submit one from the Admin Console to see results.</p>
        </div>
      ) : (
        <ul className="summary-panel__list">
          {items.map((item) => {
            const status = item.decision?.status || 'PENDING';
            const badgeClass = statusClasses[status] || 'badge';
            const transaction = item.transaction || {};
            const origin = transaction.origin || {};
            const destination = transaction.destination || {};
            const reason = item.decision?.reason || 'Awaiting workflow decision';
            const amount = formatAmount(transaction.amount, transaction.currency);

            return (
              <li key={item.id} className="summary-panel__item">
                <div className="summary-panel__row">
                  <span className={badgeClass}>{status}</span>
                  <span className="summary-panel__amount">{amount}</span>
                </div>
                <div className="summary-panel__route">
                  {origin.country || '??'} → {destination.country || '??'}
                  <span className="summary-panel__muted">
                    {' '}
                    ({origin.region || 'Unknown'} → {destination.region || 'Unknown'})
                  </span>
                </div>
                <div className="summary-panel__meta">
                  <span>{formatTimestamp(transaction.timestamp)}</span>
                  <span className="summary-panel__muted">
                    {transaction.metadata?.paymentMethod || transaction.payment_method || '—'}
                  </span>
                </div>
                <p className="summary-panel__reason">{reason}</p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
