import test from 'node:test';
import assert from 'node:assert/strict';
import { toBech32 } from '@cosmjs/encoding';
import {
  XITCOIN,
  baseAmount,
  displayAmount,
  parseBalances,
  parseValidators,
  transactionMessage,
  getDialogData,
} from '../src/libs/xitcoinTransaction.ts';
const sender = toBech32('xtc', new Uint8Array(20).fill(1));
const validator = toBech32('xtcvaloper', new Uint8Array(20).fill(2));
test('Xitcoin amounts preserve all 18 decimals without floating point rounding', () => {
  assert.equal(baseAmount('1.000000000000000001'), '1000000000000000001');
  assert.equal(displayAmount('1000000000000000001'), '1.000000000000000001');
  assert.equal(baseAmount('5250000000'), '5250000000000000000000000000');
  for (const value of [
    '0',
    '-1',
    'NaN',
    '1e18',
    '1.0000000000000000001',
    'Infinity',
    '',
  ])
    assert.throws(() => baseAmount(value));
});
test('malformed balances and validators fail closed', () => {
  for (const value of [
    null,
    {},
    { balances: null },
    { balances: [{ denom: 'axtc', amount: '-1' }] },
    { balances: [{ denom: 'axtc', amount: 1 }] },
  ])
    assert.throws(() => parseBalances(value));
  assert.equal(parseBalances({ balances: [] }), '0');
  assert.equal(
    parseBalances({
      balances: [{ denom: 'axtc', amount: '1000000000000000000' }],
    }),
    '1000000000000000000'
  );
  for (const value of [
    null,
    {},
    { validators: [{}] },
    {
      validators: [
        {
          operator_address: validator,
          description: { moniker: '' },
          status: 'BOND_STATUS_BONDED',
        },
      ],
    },
  ])
    assert.throws(() => parseValidators(value));
});
test('SEND and DELEGATE encode Xitcoin atomic amounts and reject foreign addresses', () => {
  const send = transactionMessage('send', sender, sender, '1.2');
  assert.deepEqual(send.value.amount, [
    { amount: '1200000000000000000', denom: 'axtc' },
  ]);
  const delegate = transactionMessage(
    'delegate',
    sender,
    validator,
    '0.000000000000000001'
  );
  assert.equal(delegate.value.amount.amount, '1');
  assert.equal(delegate.value.amount.denom, 'axtc');
  assert.throws(() =>
    transactionMessage(
      'send',
      sender,
      toBech32('cosmos', new Uint8Array(20)),
      '1'
    )
  );
});
test('dialog data validates chain identity, follows pagination and handles unavailable API', async () => {
  const original = globalThis.fetch;
  const urls = [];
  const node = { default_node_info: { network: XITCOIN.chainId } };
  const staking = { params: { bond_denom: 'axtc' } };
  const row = (n) => ({
    operator_address: toBech32('xtcvaloper', new Uint8Array(20).fill(n)),
    description: {
      moniker: ['Atlas', 'Borealis', 'Meridian', 'Zenith'][n - 1],
    },
    status: 'BOND_STATUS_BONDED',
  });
  try {
    globalThis.fetch = async (url) => {
      urls.push(url);
      let data = url.includes('node_info')
        ? node
        : url.includes('/params')
          ? staking
          : url.includes('/balances/')
            ? { balances: [] }
            : url.includes('pagination.key')
              ? { validators: [row(3), row(4)], pagination: { next_key: null } }
              : {
                  validators: [row(1), row(2)],
                  pagination: { next_key: 'next' },
                };
      return Response.json(data);
    };
    const data = await getDialogData(sender, new AbortController().signal);
    assert.deepEqual(
      data.validators.map((v) => v.name),
      ['Atlas', 'Borealis', 'Meridian', 'Zenith']
    );
    assert.ok(urls.every((url) => url.startsWith(XITCOIN.rest)));
    node.default_node_info.network = 'wrong-chain';
    await assert.rejects(
      getDialogData(sender, new AbortController().signal),
      /Unexpected chain/
    );
    globalThis.fetch = async () => new Response('', { status: 503 });
    await assert.rejects(
      getDialogData(sender, new AbortController().signal),
      /unavailable/
    );
  } finally {
    globalThis.fetch = original;
  }
});

test('legacy opening dispatches change and keeps the widget initialization listener', async () => {
  const { openTransactionDialog } = await import('../src/libs/transactionDialog.ts');
  const original = globalThis.document;
  const toggle = new EventTarget();
  toggle.id = 'delegate';
  toggle.checked = false;
  let initializations = 0;
  let restored = 0;
  toggle.addEventListener('change', () => { if (toggle.checked) initializations++; });
  const close = { setAttribute() {}, focus() {}, click() {} };
  const box = { setAttribute() {}, querySelector: selector => selector === 'h3' ? { textContent: 'Delegate' } : null };
  const widget = { querySelector: selector => selector === 'input.modal-toggle' ? toggle : selector === '.modal-box' ? box : null };
  box.querySelector = selector => selector === 'h3' ? { textContent: 'Delegate' } : selector === 'label.btn-circle' ? close : null;
  globalThis.document = { querySelector: () => widget, activeElement: { focus() { restored++; } } };
  try {
    await openTransactionDialog('delegate');
    assert.equal(toggle.checked, true);
    assert.equal(initializations, 1);
    box.onkeydown({ key: 'Escape', preventDefault() {} });
    assert.equal(toggle.checked, false);
    assert.ok(restored > 0);
    await openTransactionDialog('delegate');
    assert.equal(initializations, 2);
  } finally { globalThis.document = original; }
});
