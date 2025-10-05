import dayjs from 'dayjs';

const defaultConfig = {
  blockThreshold: 80,
  flagThreshold: 55,
  highRiskCountries: ['RU', 'NG', 'CN', 'IR', 'BR'],
  nightHours: [0, 5],
};

function betweenHours(timestamp, start, end) {
  const hour = dayjs(timestamp).hour();
  if (start <= end) {
    return hour >= start && hour <= end;
  }
  return hour >= start || hour <= end;
}

export default function anomalyDetection({ transaction, config = {}, services }) {
  const { blockThreshold, flagThreshold, highRiskCountries, nightHours } = {
    ...defaultConfig,
    ...config,
  };

  let score = 10;
  const metadata = {};

  if (transaction.amount > 10_000) {
    score += Math.min(60, Math.log10(transaction.amount) * 10);
    metadata.highValue = true;
  }
  if (transaction.currency && transaction.currency !== 'USD') {
    score += 8;
    metadata.fx = transaction.currency;
  }
  const originCountry = transaction.origin?.country?.toUpperCase();
  const destinationCountry = transaction.destination?.country?.toUpperCase();
  if (originCountry && destinationCountry && originCountry !== destinationCountry) {
    score += 15;
    metadata.crossBorder = true;
  }
  if (highRiskCountries.includes(originCountry) || highRiskCountries.includes(destinationCountry)) {
    score += 20;
    metadata.highRiskGeo = [originCountry, destinationCountry].filter(Boolean);
  }

  if (betweenHours(transaction.timestamp || Date.now(), nightHours[0], nightHours[1])) {
    score += 12;
    metadata.nightActivity = true;
  }

  if (transaction.metadata?.paymentMethod === 'crypto') {
    score += 10;
    metadata.crypto = true;
  }

  score = Math.min(100, Math.round(score));
  services.metrics?.recordRisk(score);

  if (score >= blockThreshold) {
    services.metrics?.increment('anomalyBlock');
    return {
      status: 'BLOCK',
      reason: `Anomaly Check score ${score} >= ${blockThreshold}.`,
      severity: 'high',
      metadata: {
        ...metadata,
        riskScore: score,
      },
    };
  }

  if (score >= flagThreshold) {
    services.metrics?.increment('anomalyFlag');
    return {
      status: 'FLAG',
      reason: `Anomaly Check score ${score} >= ${flagThreshold}.`,
      severity: 'medium',
      metadata: {
        ...metadata,
        riskScore: score,
      },
    };
  }

  return {
    status: 'CONTINUE',
    reason: `Anomaly Check score ${score} below thresholds.`,
    metadata: {
      ...metadata,
      riskScore: score,
    },
  };
}
