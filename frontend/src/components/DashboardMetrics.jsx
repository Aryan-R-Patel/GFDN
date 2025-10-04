import dayjs from 'dayjs';

const formatNumber = (value) => value?.toLocaleString?.() ?? value ?? 0;

export default function DashboardMetrics({ metrics }) {
  if (!metrics) {
    return (
      <div className="metrics">
        <div className="metrics__item">
          <small>Total processed</small>
          <strong>—</strong>
        </div>
        <div className="metrics__item">
          <small>Blocked</small>
          <strong>—</strong>
        </div>
        <div className="metrics__item">
          <small>Latency</small>
          <strong>—</strong>
        </div>
      </div>
    );
  }

  return (
    <div className="metrics">
      <div className="metrics__item">
        <small>Total processed</small>
        <strong>{formatNumber(metrics.totals.processed)}</strong>
      </div>
      <div className="metrics__item">
        <small>Blocked</small>
        <strong>{formatNumber(metrics.totals.blocked)}</strong>
      </div>
      <div className="metrics__item">
        <small>Flagged</small>
        <strong>{formatNumber(metrics.totals.flagged)}</strong>
      </div>
      <div className="metrics__item">
        <small>Estimated savings</small>
        <strong>${formatNumber(metrics.estimatedSavings)}</strong>
      </div>
      <div className="metrics__item">
        <small>Avg latency</small>
        <strong>{formatNumber(metrics.latency.averageMs)} ms</strong>
      </div>
      <div className="metrics__item">
        <small>Avg risk score</small>
        <strong>{formatNumber(metrics.risk.averageScore)}</strong>
      </div>
      <div className="metrics__item">
        <small>Updated</small>
        <strong>{dayjs().format('HH:mm:ss')}</strong>
      </div>
    </div>
  );
}
