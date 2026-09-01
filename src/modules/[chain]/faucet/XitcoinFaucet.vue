<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { fromBech32, fromHex, toBech32 } from '@cosmjs/encoding';
import { useBlockchain } from '@/stores';
import { useI18n } from 'vue-i18n';

interface HealthResponse {
  status: string;
  chain_id: string;
  claim_amount_xtc: string;
  funded: boolean;
}

interface ClaimResponse {
  ok?: boolean;
  amount_xtc?: string;
  txhash?: string;
  tx_hash?: string;
  hash?: string;
  tx_response?: {
    txhash?: string;
  };
  error?: string;
}

const chainStore = useBlockchain();
const { t } = useI18n();
const address = ref('');
const health = ref<HealthResponse>();
const message = ref(t('xitcoin_faucet.checking'));
const pending = ref(false);
const txHash = ref('');

const endpoint = computed(() => chainStore.current?.faucet?.endpoint?.replace(/\/$/, '') || '');
const normalizedAddress = computed(() => {
  const value = address.value.trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(value)) {
    return toBech32(chainStore.current?.bech32Prefix || 'xtc', fromHex(value.slice(2)));
  }
  return value;
});
const validAddress = computed(() => {
  if (!address.value) return true;
  try {
    const decoded = fromBech32(normalizedAddress.value);
    return decoded.prefix === (chainStore.current?.bech32Prefix || 'xtc') && decoded.data.length === 20;
  } catch {
    return false;
  }
});
const ready = computed(() => Boolean(health.value?.funded && endpoint.value));
const canClaim = computed(
  () => Boolean(ready.value && validAddress.value && address.value && !pending.value)
);
const transactionPath = computed(() =>
  txHash.value ? `/${chainStore.chainName}/tx/${txHash.value}` : ''
);

async function refreshHealth() {
  const response = await fetch(`${endpoint.value}/healthz`);
  if (!response.ok) throw new Error('health_unavailable');
  const result: HealthResponse = await response.json();
  if (result.status !== 'ok' || result.chain_id !== 'xitcoin-testnet-v2-1' || result.claim_amount_xtc !== '10') {
    throw new Error('health_mismatch');
  }
  health.value = result;
  message.value = result.funded
    ? t('xitcoin_faucet.ready', { amount: result.claim_amount_xtc })
    : t('xitcoin_faucet.unavailable');
}

async function claim() {
  if (!canClaim.value) return;
  pending.value = true;
  txHash.value = '';
  message.value = t('xitcoin_faucet.submitting');
  try {
    const response = await fetch(`${endpoint.value}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: normalizedAddress.value }),
    });
    const result: ClaimResponse = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || 'claim_failed');

    const returnedHash =
      result.txhash || result.tx_hash || result.hash || result.tx_response?.txhash || '';
    if (/^[A-Fa-f0-9]{64}$/.test(returnedHash)) {
      txHash.value = returnedHash.toUpperCase();
    }

    message.value = t('xitcoin_faucet.sent', {
      amount: result.amount_xtc || health.value?.claim_amount_xtc || '10',
    });
  } catch (error) {
    message.value = t('xitcoin_faucet.refused', {
      error: error instanceof Error ? error.message : 'unknown_error',
    });
  } finally {
    pending.value = false;
  }
}

onMounted(() => {
  refreshHealth().catch(() => {
    message.value = t('xitcoin_faucet.unavailable');
  });
});
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <div class="mt-14 mb-6 flex flex-col items-center justify-center gap-4 text-center">
      <img
        v-if="chainStore.current?.logo"
        :src="chainStore.current.logo"
        class="h-16 w-16 rounded-md"
        alt="Xitcoin"
      />
      <h1 class="text-3xl font-bold text-primary md:!text-6xl">
        {{ $t('xitcoin_faucet.title') }}
      </h1>
      <p class="text-base text-base-content/70">
        {{ $t('xitcoin_faucet.intro') }}
      </p>
    </div>

    <div class="my-5 rounded bg-base-100 px-4 pt-3 pb-4 shadow">
      <h2 class="card-title">{{ $t('xitcoin_faucet.address') }}</h2>
      <input
        id="faucet-address"
        v-model.trim="address"
        class="mt-4 mb-2 w-full rounded-md border border-gray-300 bg-base-100 p-2 text-base-content"
        :class="{ 'input-error': !validAddress }"
        placeholder="xtc1… or 0x…"
        autocomplete="off"
        spellcheck="false"
      />
      <p v-if="!validAddress" class="mb-3 text-sm text-error">
        {{ $t('xitcoin_faucet.invalid_address') }}
      </p>
      <button
        class="btn btn-primary mt-2 w-full text-white"
        :class="{ 'cursor-not-allowed opacity-60': !canClaim }"
        :aria-disabled="!canClaim"
        :tabindex="canClaim ? 0 : -1"
        @click="claim"
      >
        <span v-if="pending" class="loading loading-spinner loading-sm"></span>
        {{ $t('xitcoin_faucet.request') }}
      </button>
      <div class="mt-4 rounded bg-base-200 p-3 text-sm text-base-content" aria-live="polite">
        {{ message }}
      </div>
      <div v-if="txHash" class="mt-3 rounded border border-success/40 bg-success/10 p-3">
        <p class="mb-1 text-sm font-semibold text-success">Transaction confirmed</p>
        <RouterLink :to="transactionPath" class="break-all text-sm text-primary underline">
          {{ txHash }}
        </RouterLink>
      </div>
      <p class="mt-3 text-sm text-base-content/70">
        {{ $t('xitcoin_faucet.policy') }}
      </p>
    </div>
  </div>
</template>
