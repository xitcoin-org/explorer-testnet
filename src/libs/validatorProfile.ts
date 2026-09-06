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
