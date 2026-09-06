<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { XitcoinSigningClient } from '@/libs/xitcoinSigning';
import { useTxDialog, useWalletStore } from '@/stores';
import {
  XITCOIN,
  baseAmount,
  displayAmount,
  getDialogData,
  transactionMessage,
  type DialogValidator,
} from '@/libs/xitcoinTransaction';

const store = useTxDialog();
const wallet = useWalletStore();
const modal = ref<HTMLDialogElement>();
const amount = ref('');
const destination = ref('');
const memo = ref('');
const balance = ref('0');
const validators = ref<DialogValidator[]>([]);
const error = ref('');
const status = ref('');
const loading = ref(false);
const busy = ref(false);
const ready = ref(false);
const gas = ref(0);
let generation = 0;
let abort: AbortController | undefined;
let previousFocus: HTMLElement | null = null;
const title = computed(() => (store.type === 'delegate' ? 'Delegate' : 'Send'));
const fee = computed(() => String(Math.ceil(gas.value * 10))); // 0.00000000000000001 XTC/gas
const disabled = computed(
  () => loading.value || busy.value || !ready.value || !store.sender
);

async function load() {
  const current = ++generation;
  abort?.abort();
  abort = new AbortController();
  const requestAbort = abort;
  const timer = setTimeout(() => requestAbort.abort(), 15000);
  status.value = '';
  loading.value = true;
  ready.value = false;
  gas.value = 0;
  error.value = '';
  validators.value = [];
  balance.value = '0';
  try {
    const data = await getDialogData(store.sender, abort.signal);
    if (current !== generation) return;
    validators.value = data.validators;
    balance.value = data.balance;
    ready.value = true;
  } catch (e) {
    if (current === generation)
      error.value =
        e instanceof Error && e.name !== 'AbortError'
          ? e.message
          : 'Xitcoin API request timed out. Please retry.';
  } finally {
    clearTimeout(timer);
    if (current === generation) loading.value = false;
  }
}
watch(
  () => store.openSequence,
  async () => {
    if (!store.openSequence) return;
    previousFocus = document.activeElement as HTMLElement;
    amount.value = '';
    memo.value = '';
    status.value = '';
    gas.value = 0;
    try {
      destination.value =
        JSON.parse(store.params || '{}').validator_address || '';
    } catch {
      destination.value = '';
    }
    await nextTick();
    modal.value?.showModal();
    await load();
  },
  { immediate: true }
);
watch([amount, destination, memo], () => {
  gas.value = 0;
  status.value = '';
});
watch(
  () => wallet.currentAddress,
  async (address) => {
    if (!modal.value?.open) return;
    store.sender = address;
    await load();
  }
);
function trapFocus(event: KeyboardEvent) {
  if (event.key !== 'Tab') return;
  const controls = Array.from(
    modal.value?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled)'
    ) || []
  );
  const first = controls[0];
  const last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}
function close() {
  if (busy.value) return;
  generation++;
  abort?.abort();
  modal.value?.close();
  previousFocus?.focus();
}
onBeforeUnmount(() => {
  generation++;
  abort?.abort();
});

async function client() {
  const providerName = String(
    wallet.connectedWallet?.wallet || 'keplr'
  ).toLowerCase();
  const provider = (window as any)[providerName];
  if (!provider?.enable || !provider?.getOfflineSigner)
    throw new Error('Connect a compatible Keplr or Leap wallet first.');
  return XitcoinSigningClient.connect(provider, store.sender);
}
function message() {
  if (
    store.type === 'delegate' &&
    !validators.value.some((v) => v.address === destination.value)
  )
    throw new Error('Select an available validator.');
  if (BigInt(baseAmount(amount.value)) > BigInt(balance.value))
    throw new Error('Amount exceeds your available XTC balance.');
  if (memo.value.length > 256)
    throw new Error('Memo must contain at most 256 characters.');
  return transactionMessage(
    store.type,
    store.sender,
    destination.value,
    amount.value
  );
}
async function simulate() {
  if (disabled.value) return;
  const current = generation;
  busy.value = true;
  error.value = '';
  status.value = '';
  gas.value = 0;
  let connection: XitcoinSigningClient | undefined;
  try {
    const msg = message();
    connection = await client();
    if (current !== generation)
      throw new Error('Wallet changed. Please retry.');
    const estimate = await connection.simulate([msg], memo.value);
    if (current !== generation)
      throw new Error('Wallet changed. Please retry.');
    if (!Number.isSafeInteger(estimate) || estimate <= 0)
      throw new Error('Malformed simulation result.');
    gas.value = Math.ceil(estimate * 1.5);
    status.value =
      'Simulation successful. No transaction has been signed or broadcast.';
  } catch (e) {
    error.value =
      e instanceof Error
        ? e.message
        : 'Simulation failed or was rejected by your wallet.';
  } finally {
    busy.value = false;
  }
}
async function submit() {
  if (disabled.value || !gas.value) return;
  const current = generation;
  busy.value = true;
  error.value = '';
  status.value = '';
  let connection: XitcoinSigningClient | undefined;
  try {
    const msg = message();
    if (
      BigInt(baseAmount(amount.value)) + BigInt(fee.value) >
      BigInt(balance.value)
    )
      throw new Error('Insufficient XTC for amount and fee.');
    connection = await client();
    if (current !== generation)
      throw new Error('Wallet changed. Please retry.');
    const hash = await connection.signAndBroadcast(
      [msg],
      memo.value,
      String(gas.value),
      fee.value,
      () => current === generation
    );
    status.value = `Transaction submitted: ${hash}. Check the explorer for confirmation.`;
    gas.value = 0;
  } catch (e) {
    error.value =
      e instanceof Error ? e.message : 'Transaction rejected by your wallet.';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <dialog
    ref="modal"
    class="xitcoin-tx-dialog"
    aria-labelledby="xitcoin-tx-title"
    @cancel.prevent="close"
    @keydown="trapFocus"
  >
    <div
      class="xitcoin-tx-content"
      :data-chain-id="XITCOIN.chainId"
      :data-rest="XITCOIN.rest"
      :data-rpc="XITCOIN.rpc"
      :data-denom="XITCOIN.coinMinimalDenom"
      :data-decimals="XITCOIN.coinDecimals"
    >
      <div class="flex items-center justify-between gap-4">
        <h2 id="xitcoin-tx-title" class="text-xl font-semibold">{{ title }}</h2>
        <button
          type="button"
          class="btn btn-sm"
          aria-label="Close dialog"
          :disabled="busy"
          autofocus
          @click="close"
        >
          Close
        </button>
      </div>
      <p>{{ XITCOIN.chainName }} · {{ XITCOIN.coinDenom }}</p>
      <p class="text-xs break-all">{{ XITCOIN.chainId }}</p>
      <p v-if="!store.sender" role="status">
        No wallet connected. Connect your Xitcoin wallet to continue.
      </p>
      <p v-if="loading" role="status">
        Loading Xitcoin balances and validators…
      </p>
      <p v-if="error" role="alert" class="tx-error">{{ error }}</p>
      <button
        v-if="!ready && !loading"
        type="button"
        class="btn btn-sm"
        @click="load"
      >
        Retry
      </button>
      <form @submit.prevent="simulate">
        <label for="xitcoin-tx-sender">Sender</label>
        <input
          id="xitcoin-tx-sender"
          :value="store.sender"
          readonly
          placeholder="No wallet connected"
        />
        <template v-if="store.type === 'delegate'">
          <label for="xitcoin-tx-validator">Validator</label>
          <select
            id="xitcoin-tx-validator"
            v-model="destination"
            :disabled="loading || busy || !ready"
          >
            <option value="">Select a validator</option>
            <option
              v-for="validator in validators"
              :key="validator.address"
              :value="validator.address"
            >
              {{ validator.name }}
            </option>
          </select>
          <p v-if="ready && !validators.length" role="status">
            No active validators available.
          </p>
        </template>
        <template v-else>
          <label for="xitcoin-tx-recipient">Recipient</label>
          <input
            id="xitcoin-tx-recipient"
            v-model="destination"
            :disabled="disabled"
            autocomplete="off"
            spellcheck="false"
            placeholder="xtc…"
          />
        </template>
        <label for="xitcoin-tx-amount">Amount (XTC)</label>
        <input
          id="xitcoin-tx-amount"
          v-model="amount"
          :disabled="disabled"
          inputmode="decimal"
          autocomplete="off"
          placeholder="0.0"
        />
        <p>
          Available:
          {{ ready && store.sender ? displayAmount(balance) : 'Unavailable' }}
          XTC
        </p>
        <label for="xitcoin-tx-memo">Memo (optional)</label>
        <input
          id="xitcoin-tx-memo"
          v-model="memo"
          :disabled="disabled"
          maxlength="256"
        />
        <p v-if="status" role="status" class="break-words">{{ status }}</p>
        <p v-if="gas">
          Estimated gas: {{ gas }} · Fee: {{ displayAmount(fee) }} XTC
        </p>
        <div class="flex flex-wrap gap-3 mt-4">
          <button
            type="submit"
            class="btn btn-primary flex-1"
            :disabled="disabled"
          >
            {{ busy ? 'Please wait…' : 'Simulate' }}
          </button>
          <button
            type="button"
            class="btn btn-primary flex-1"
            :disabled="disabled || !gas"
            @click="submit"
          >
            Sign and broadcast
          </button>
        </div>
      </form>
    </div>
  </dialog>
</template>
<style scoped>
.xitcoin-tx-dialog {
  padding: 0;
  border: 1px solid #64748b;
  border-radius: 16px;
  background: #fff;
  color: #172033;
  width: min(540px, calc(100vw - 24px));
  max-height: calc(100dvh - 24px);
  overflow: auto;
}
.xitcoin-tx-dialog::backdrop {
  background: rgb(0 0 0 / 65%);
}
.xitcoin-tx-content {
  padding: 24px;
}
label {
  display: block;
  margin: 12px 0 4px;
  font-weight: 600;
}
input,
select {
  display: block;
  width: 100%;
  min-width: 0;
  padding: 10px;
  border: 1px solid #64748b;
  border-radius: 8px;
  background: transparent;
  color: inherit;
}
input:disabled,
select:disabled {
  opacity: 0.7;
}
.tx-error {
  padding: 10px;
  border: 1px solid currentColor;
  color: #b91c1c;
  margin-top: 12px;
}
:global(html[data-theme='dark'] .xitcoin-tx-dialog) {
  background: #172033;
  color: #f1f5f9;
}
:global(html[data-theme='dark'] .xitcoin-tx-dialog .tx-error) {
  color: #fca5a5;
}
.btn {
  /* Keep text/background contrast stable when wallet actions become enabled. */
  transition: none !important;
  background: #e2e8f0 !important;
  color: #172033 !important;
  border-color: #64748b !important;
  opacity: 1 !important;
}
.btn-primary {
  background: #4338ca !important;
  color: #fff !important;
}
.btn:disabled {
  background: #cbd5e1 !important;
  color: #334155 !important;
}
option {
  background: #fff;
  color: #172033;
}
</style>
