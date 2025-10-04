export class MetricsManager {
  constructor() {
    this.totalProcessed = 0;
    this.totalApproved = 0;
    this.totalFlagged = 0;
    this.totalBlocked = 0;
    this.estimatedSavings = 0;
    this.latencySamples = [];
    this.counters = new Map();
    this.riskScores = [];
  }

  incrementCounter(decision, amount = 0) {
    this.totalProcessed += 1;
    if (decision === 'APPROVE') this.totalApproved += 1;
    if (decision === 'FLAG') this.totalFlagged += 1;
    if (decision === 'BLOCK') {
      this.totalBlocked += 1;
      this.estimatedSavings += amount * 0.85; // assume 85% of blocked amount saved
    }
  }

  recordLatency(ms) {
    this.latencySamples.push(ms);
    if (this.latencySamples.length > 1000) {
      this.latencySamples.shift();
    }
  }

  increment(key) {
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + 1);
  }

  recordRisk(score) {
    this.riskScores.push(score);
    if (this.riskScores.length > 500) {
      this.riskScores.shift();
    }
  }

  snapshot() {
    const avgLatency =
      this.latencySamples.length > 0
        ? this.latencySamples.reduce((acc, cur) => acc + cur, 0) / this.latencySamples.length
        : 0;
    const avgRisk =
      this.riskScores.length > 0
        ? this.riskScores.reduce((acc, cur) => acc + cur, 0) / this.riskScores.length
        : 0;

    return {
      totals: {
        processed: this.totalProcessed,
        approved: this.totalApproved,
        flagged: this.totalFlagged,
        blocked: this.totalBlocked,
      },
      estimatedSavings: Number(this.estimatedSavings.toFixed(2)),
      latency: {
        averageMs: Number(avgLatency.toFixed(2)),
        samples: this.latencySamples.length,
      },
      risk: {
        averageScore: Number(avgRisk.toFixed(2)),
        samples: this.riskScores.length,
      },
      counters: Object.fromEntries(this.counters.entries()),
    };
  }
}
