/** Presentation of on-chain values: missing data must never become zero. */
export const UNAVAILABLE = 'Non disponible';
export const NOT_APPLICABLE = 'Non applicable';

export function textValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function websiteLink(value: unknown): string | undefined {
  const text = textValue(value);
  if (!text || /[\s\u0000-\u001f]/.test(text)) return;
  try {
    const url = new URL(text);
    if (
      ['https:', 'http:'].includes(url.protocol) &&
      !url.username &&
      !url.password
    )
      return text;
  } catch {
    /* Untrusted metadata is rendered as text, never as a URL. */
  }
}

export function contactLink(value: unknown): string | undefined {
  const text = textValue(value);
  if (text && /^[^\s@<>?&#%:]+@[^\s@<>?&#%:]+\.[^\s@<>?&#%:]+$/.test(text))
    return `mailto:${text}`;
}

export function decimalValue(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^\d+(\.\d+)?$/.test(value)) return;
  const [whole, fraction = ''] = value.split('.');
  const tail = fraction.replace(/0+$/, '');
  return `${BigInt(whole)}${tail ? `.${tail}` : ''}`;
}

export function tokenAmount(
  value: unknown,
  denom: unknown,
  asset?: { base: string; exponent: string | number; symbol: string }
): string {
  const decimal = decimalValue(value);
  if (decimal === undefined || typeof denom !== 'string' || !denom)
    return UNAVAILABLE;
  if (!asset || asset.base !== denom) return `${decimal} ${denom}`;
  const exponent = Number(asset.exponent);
  if (
    !Number.isInteger(exponent) ||
    exponent < 0 ||
    exponent > 255 ||
    !asset.symbol
  )
    return UNAVAILABLE;
  const [whole, fraction = ''] = decimal.split('.');
  const padded = whole.padStart(exponent + 1, '0');
  const integer = exponent ? padded.slice(0, -exponent) : padded;
  const tail = `${exponent ? padded.slice(-exponent) : ''}${fraction}`.replace(
    /0+$/,
    ''
  );
  return `${BigInt(integer)}${tail ? `.${tail}` : ''} ${asset.symbol}`;
}

// Shares are dimensionless accounting units, not atomic tokens. The UI exposes the raw value in a title.
export function sharesValue(value: unknown): string {
  const decimal = decimalValue(value);
  if (decimal === undefined) return UNAVAILABLE;
  const [whole, fraction = ''] = decimal.split('.');
  if (fraction.length <= 6) return `${decimal} parts`;
  if (whole === '0' && !/[1-9]/.test(fraction.slice(0, 6)))
    return '< 0.000001 parts';
  const scaled =
    BigInt(whole) * 1000000n +
    BigInt(fraction.slice(0, 6)) +
    (Number(fraction[6]) >= 5 ? 1n : 0n);
  const tail = (scaled % 1000000n)
    .toString()
    .padStart(6, '0')
    .replace(/0+$/, '');
  return `≈ ${scaled / 1000000n}${tail ? `.${tail}` : ''} parts`;
}

export function jailedValue(value: unknown): string {
  return value === true ? 'Oui' : value === false ? 'Non' : UNAVAILABLE;
}

export function unbondingValue(
  status: unknown,
  value: unknown,
  kind: 'height' | 'time'
): string {
  if (status === 'BOND_STATUS_BONDED' || status === 'BOND_STATUS_UNBONDED')
    return NOT_APPLICABLE;
  if (status !== 'BOND_STATUS_UNBONDING') return UNAVAILABLE;
  if (kind === 'height')
    return typeof value === 'string' &&
      /^\d+$/.test(value) &&
      BigInt(value) > 0n
      ? BigInt(value).toString()
      : UNAVAILABLE;
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    Date.parse(value) <= 0
  )
    return UNAVAILABLE;
  return new Date(value)
    .toISOString()
    .replace('T', ' ')
    .replace('.000Z', ' UTC');
}

export function estimatedApr(
  inflation: unknown,
  tax: unknown,
  commission: unknown,
  bonded: unknown,
  supply: unknown
): string {
  const values = [inflation, tax, commission, bonded, supply].map(decimalValue);
  if (values.some((x) => x === undefined)) return UNAVAILABLE;
  const [i, t, c, b, s] = values.map(Number);
  if (
    ![i, t, c, b, s].every(Number.isFinite) ||
    i > 1 ||
    t > 1 ||
    c > 1 ||
    b <= 0 ||
    s < b
  )
    return UNAVAILABLE;
  const percent = i * (1 - t) * (1 - c) * (s / b) * 100;
  if (!Number.isFinite(percent)) return UNAVAILABLE;
  if (percent > 0 && percent < 0.0001) return '< 0.0001 %';
  return `${Number(percent.toFixed(4))} %`;
}

/** Parameter names define units; small numeric values are not implicitly percentages. */
export function parameterValue(value: unknown, key: string, assets: {base: string; symbol: string; exponent: number | string}[] = []): string {
  if (Array.isArray(value)) {
    if (!value.length) return UNAVAILABLE;
    return value.map(coin => tokenAmount(coin?.amount, coin?.denom, assets.find(a => a.base === coin?.denom))).join(', ');
  }
  if (value === undefined || value === null || value === '') return UNAVAILABLE;
  if (typeof value === 'boolean') return String(value);
  if (/^(inflation|inflation_rate_change|inflation_max|inflation_min|goal_bonded|community_tax|base_proposer_reward|bonus_proposer_reward|quorum|threshold|veto_threshold|min_signed_per_window|slash_fraction_double_sign|slash_fraction_downtime)$/.test(key)) {
    const decimal = decimalValue(value);
    if (decimal === undefined || !Number.isFinite(Number(decimal)) || Number(decimal) > 1) return UNAVAILABLE;
    const n = Number(decimal) * 100;
    return n > 0 && n < 0.0001 ? '< 0.0001 %' : `${Number(n.toFixed(4))} %`;
  }
  if (key === 'max_supply') return assets.length === 1 ? tokenAmount(value, assets[0].base, assets[0]) : UNAVAILABLE;
  return typeof value === 'string' || typeof value === 'number' ? String(value) : UNAVAILABLE;
}

/** Registry display denoms may use symbol casing while denomination units are lowercase. */
export function parameterAssets(assets: {base: string; symbol: string; display: string; denom_units: {denom: string; exponent: number}[]}[]) {
  return assets.flatMap(a => {
    const unit = a.denom_units.find(u => u.denom.toLowerCase() === a.display.toLowerCase());
    return unit ? [{base: a.base, symbol: a.symbol, exponent: unit.exponent}] : [];
  });
}
