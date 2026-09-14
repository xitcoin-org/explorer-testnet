// A broadcast hash is not proof of inclusion. Ambiguous outcomes block retry.
export function faucetResponse(status: number, body: unknown) {
  const data = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const rejected = [400, 429, 503].includes(status) &&
    typeof data.error === 'string' && [
      'invalid_request', 'invalid_xitcoin_address', 'address_limit', 'ip_limit',
      'faucet_not_funded', 'faucet_busy', 'journal_unavailable',
    ].includes(data.error);
  const nested = data.tx_response && typeof data.tx_response === 'object'
    ? data.tx_response as Record<string, unknown> : {};
  const hash = data.txhash || data.tx_hash || data.hash || nested.txhash;
  return {
    reconciliationRequired: !rejected,
    error: rejected ? String(data.error) : '',
    txHash: !rejected && typeof hash === 'string' && /^[a-fA-F0-9]{64}$/.test(hash)
      ? hash.toUpperCase() : '',
    requestId: !rejected && typeof data.request_id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(data.request_id)
      ? data.request_id : '',
  };
}
