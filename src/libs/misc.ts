import { sha256 } from '@cosmjs/crypto';
import { toHex } from '@cosmjs/encoding';

export function newPageRequest(param: {
  key?: Uint8Array;
  limit?: number;
  offset?: number;
  countTotal?: boolean;
  reverse?: boolean;
}) {
  return param;
}

export function hashTx(raw: Uint8Array) {
  return toHex(sha256(raw)).toUpperCase();
}

export function publicValidatorMoniker(moniker?: string, chainName?: string) {
  if (!moniker) return '';
  if (chainName === 'xitcoin-testnet') {
    return moniker.replace(/^Xitcoin Testnet V2\s+/i, 'Xitcoin ');
  }
  return moniker;
}
