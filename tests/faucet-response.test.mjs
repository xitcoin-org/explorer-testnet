import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { parse, compileScript } from '@vue/compiler-sfc';
import ts from 'typescript';
import { faucetResponse } from '../src/libs/faucetResponse.ts';
const hash = 'a'.repeat(64);

test('new pending responses and legacy hashes never establish confirmation', () => {
  for (const [status, body] of [[202, { status: 'unknown', request_id: 'test-1' }], [202, { status: 'submitted', txhash: hash }], [200, { ok: true, txhash: hash }], [500, { error: 'internal_error' }], [502, null]]) {
    assert.equal(faucetResponse(status, body).reconciliationRequired, true);
  }
  assert.equal(faucetResponse(202, { txhash: hash }).txHash, hash.toUpperCase());
  assert.equal(faucetResponse(202, { txhash: 'invalid' }).txHash, '');
  assert.equal(faucetResponse(429, { error: 'ip_limit' }).reconciliationRequired, false);
  assert.equal(faucetResponse(503, { error: 'unknown_gateway_error' }).reconciliationRequired, true);
});

test('actual component handles 202, legacy response and network ambiguity without a second request', async () => {
  const source = fs.readFileSync(new URL('../src/modules/[chain]/faucet/XitcoinFaucet.vue', import.meta.url), 'utf8');
  const { descriptor } = parse(source);
  const code = ts.transpileModule(compileScript(descriptor, { id: 'offline-faucet' }).content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const scenario of ['pending', 'legacy', 'network-error', 'invalid-json', 'quota']) {
    let calls = 0, mounted;
    const vue = { defineComponent: x => x, ref: value => ({ value }), computed: getter => ({ get value() { return getter(); } }), onMounted: callback => { mounted = callback; } };
    const modules = {
      vue,
      '@cosmjs/encoding': { fromBech32: () => ({ prefix: 'xtc', data: new Uint8Array(20) }) },
      '@/stores': { useBlockchain: () => ({ chainName: 'xitcoin-testnet', current: { bech32Prefix: 'xtc', faucet: { endpoint: '/synthetic-faucet' } } }) },
      'vue-i18n': { useI18n: () => ({ t: key => key }) },
      '@/libs/faucetResponse': { faucetResponse },
    };
    const exports = {};
    const context = { exports, require: name => { assert.ok(name in modules, name); return modules[name]; }, fetch: async (url, options) => {
      if (url.endsWith('/healthz')) return { ok: true, json: async () => ({ status: 'ok', chain_id: 'xitcoin-testnet-v2-1', claim_amount_xtc: '10', funded: true }) };
      assert.equal(url, '/synthetic-faucet/claim'); assert.equal(options.method, 'POST'); calls++;
      if (scenario === 'network-error') throw new Error('synthetic timeout');
      return { status: scenario === 'legacy' ? 200 : scenario === 'quota' ? 429 : 202, json: async () => {
        if (scenario === 'invalid-json') throw new Error('synthetic truncated response');
        return scenario === 'legacy' ? { ok: true, txhash: hash } : scenario === 'quota' ? { error: 'ip_limit' } : { status: 'unknown', request_id: 'test-1' };
      } };
    } };
    vm.runInNewContext(code, context);
    const component = exports.default.setup({}, { expose() {} });
    mounted(); await new Promise(resolve => setImmediate(resolve));
    component.address.value = 'synthetic-address';
    assert.equal(component.canClaim.value, true);
    await component.claim();
    if (scenario === 'quota') {
      assert.equal(component.reconciliationRequired.value, false);
      assert.equal(component.message.value, 'xitcoin_faucet.refused');
    } else {
      assert.equal(component.canClaim.value, false);
      assert.equal(component.message.value, 'xitcoin_faucet.awaiting_reconciliation');
      await component.claim(); assert.equal(calls, 1);
    }
  }
});
