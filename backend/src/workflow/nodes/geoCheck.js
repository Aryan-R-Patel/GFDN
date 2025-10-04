const defaultConfig = {
  allowedCountries: ['US', 'CA', 'GB', 'DE', 'FR', 'AU'],
  action: 'BLOCK',
};

function isCountryAllowed(countryCode, allowed) {
  if (!countryCode) return false;
  if (!Array.isArray(allowed) || allowed.length === 0) return true;
  return allowed.includes(countryCode.toUpperCase());
}

export default function geoCheck({ transaction, config = {}, services }) {
  const { allowedCountries, action } = { ...defaultConfig, ...config };
  const originAllowed = isCountryAllowed(transaction.origin?.country, allowedCountries);
  const destinationAllowed = isCountryAllowed(transaction.destination?.country, allowedCountries);

  if (originAllowed && destinationAllowed) {
    return {
      status: 'CONTINUE',
      reason: 'Origin and destination within allowed geographies.',
    };
  }

  const blockedCountries = [];
  if (!originAllowed) blockedCountries.push(`origin: ${transaction.origin?.country || 'UNKNOWN'}`);
  if (!destinationAllowed) blockedCountries.push(
    `destination: ${transaction.destination?.country || 'UNKNOWN'}`,
  );

  const detail = blockedCountries.join(', ');
  services.metrics?.increment('geoAlert');

  return {
    status: action === 'FLAG' ? 'FLAG' : 'BLOCK',
    reason: `Geo Check triggered (${detail}).`,
    severity: action === 'FLAG' ? 'medium' : 'high',
  };
}
