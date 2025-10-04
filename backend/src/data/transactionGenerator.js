import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';
import dayjs from 'dayjs';

const regions = [
  {
    region: 'North America',
    countries: [
      { code: 'US', lat: 38.9, lng: -77 },
      { code: 'CA', lat: 45.4, lng: -75.7 },
      { code: 'MX', lat: 19.4, lng: -99.1 },
    ],
  },
  {
    region: 'Europe',
    countries: [
      { code: 'GB', lat: 51.5, lng: -0.1 },
      { code: 'DE', lat: 52.5, lng: 13.4 },
      { code: 'FR', lat: 48.9, lng: 2.4 },
      { code: 'ES', lat: 40.4, lng: -3.7 },
      { code: 'IT', lat: 41.9, lng: 12.5 },
      { code: 'NL', lat: 52.3, lng: 4.8 },
    ],
  },
  {
    region: 'Asia',
    countries: [
      { code: 'SG', lat: 1.35, lng: 103.82 },
      { code: 'JP', lat: 35.7, lng: 139.7 },
      { code: 'CN', lat: 39.9, lng: 116.4 },
      { code: 'IN', lat: 28.6, lng: 77.2 },
      { code: 'HK', lat: 22.3, lng: 114.2 },
    ],
  },
  {
    region: 'South America',
    countries: [
      { code: 'BR', lat: -23.5, lng: -46.6 },
      { code: 'AR', lat: -34.6, lng: -58.4 },
      { code: 'CO', lat: 4.7, lng: -74.1 },
      { code: 'CL', lat: -33.4, lng: -70.7 },
    ],
  },
  {
    region: 'Africa',
    countries: [
      { code: 'ZA', lat: -26.2, lng: 28.0 },
      { code: 'NG', lat: 6.5, lng: 3.3 },
      { code: 'EG', lat: 30.0, lng: 31.2 },
      { code: 'KE', lat: -1.29, lng: 36.82 },
    ],
  },
  {
    region: 'Oceania',
    countries: [{ code: 'AU', lat: -33.8, lng: 151.2 }],
  },
  {
    region: 'Eastern Europe',
    countries: [{ code: 'RU', lat: 55.7, lng: 37.6 }],
  },
];

const paymentMethods = ['card', 'wire', 'ach', 'crypto', 'wallet'];

function randomChoice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomAmount() {
  const buckets = [25, 50, 100, 250, 500, 1000, 2500, 5000, 10_000, 25_000];
  const base = randomChoice(buckets);
  const variance = base * (Math.random() * 0.4 - 0.2);
  return Math.max(5, Math.round(base + variance));
}

function randomRegion() {
  const pick = randomChoice(regions);
  const country = randomChoice(pick.countries);
  const city = `${randomChoice(['New', 'Old', 'Port', 'San', 'East', 'West'])} ${randomChoice([
    'York',
    'Haven',
    'Harbor',
    'Ville',
    'Angeles',
    'Francisco',
    'Berlin',
    'Paris',
    'Tokyo',
    'Lagoon',
  ])}`;
  return { region: pick.region, country: country.code, lat: country.lat, lng: country.lng, city };
}

export class TransactionGenerator extends EventEmitter {
  constructor(intervalMs = 1200) {
    super();
    this.intervalMs = intervalMs;
    this.timer = null;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      const origin = randomRegion();
      const destination = randomRegion();
      const transaction = {
        id: uuid(),
        timestamp: dayjs().toISOString(),
        amount: randomAmount(),
        currency: randomChoice(['USD', 'EUR', 'USD', 'USD', 'GBP', 'SGD']),
        origin: {
          ...origin,
          deviceId: `device-${Math.floor(Math.random() * 50)}`,
          account: `acct-${Math.floor(Math.random() * 1000)}`,
          ip: `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(
            Math.random() * 255,
          )}.${Math.floor(Math.random() * 255)}`,
        },
        destination: {
          ...destination,
          account: `acct-${Math.floor(Math.random() * 1000)}`,
        },
        metadata: {
          paymentMethod: randomChoice(paymentMethods),
          merchantCategory: randomChoice(['retail', 'travel', 'gaming', 'services', 'electronics']),
        },
      };
      this.emit('transaction', transaction);
    }, this.intervalMs);
  }

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }
}
