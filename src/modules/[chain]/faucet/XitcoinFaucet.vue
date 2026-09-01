<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { fromBech32 } from '@cosmjs/encoding';
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
  error?: string;
}

const chainStore = useBlockchain();
const { t } = useI18n();
const address = ref('');
const health = ref<HealthResponse>();
const message = ref(t('xitcoin_faucet.checking'));
const pending = ref(false);

const endpoint = computed(() => chainStore.current?.faucet?.endpoint?.replace(/\/$/, '') || '');
const validAddress = computed(() => {
  if (!address.value) return true;
  try {
    const decoded = fromBech32(address.value);
    return decoded.prefix === (chainStore.current?.bech32Prefix || 'xtc') && decoded.data.length === 20;
  } catch {
    return false;
  }
});
const ready = computed(() => Boolean(health.value?.funded && endpoint.value));

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
  if (!ready.value || !validAddress.value || !address.value) return;
  pending.value = true;
  message.value = t('xitcoin_faucet.submitting');
  try {
    const response = await fetch(`${endpoint.value}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: address.value.trim() }),
    });
    const result: ClaimResponse = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || 'claim_failed');
    message.value = t('xitcoin_faucet.sent', { amount: result.amount_xtc || health.value?.claim_amount_xtc || '10' });
    if (result.txhash && /^[A-Fa-f0-9]{64}$/.test(result.txhash)) {
      window.location.assign(`/${chainStore.chainName}/tx/${result.txhash}`);
    }
  } catch (error) {
    message.value = t('xitcoin_faucet.refused', { error: error instanceof Error ? error.message : 'unknown_error' });
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
  <div class="mx-auto max-w-xl py-6">
    <div class="mb-5 flex items-center gap-3">
      <img v-if="chainStore.current?.logo" :src="chainStore.current.logo" class="h-11 w-11 rounded-lg" alt="Xitcoin" />
      <div>
        <h1 class="text-2xl font-semibold text-base-content">{{ $t('xitcoin_faucet.title') }}</h1>
        <p class="mt-1 text-sm text-base-content/70">{{ $t('xitcoin_faucet.intro') }}</p>
      </div>
    </div>

    <div class="rounded-lg border border-base-300 bg-base-100 p-5 shadow-sm">
      <label class="mb-2 block text-sm font-medium" for="faucet-address">{{ $t('xitcoin_faucet.address') }}</label>
      <input
        id="faucet-address"
        v-model.trim="address"
        class="input input-bordered w-full"
        :class="{ 'input-error': !validAddress }"
        placeholder="xtc1…"
        autocomplete="off"
        spellcheck="false"
      />
      <p v-if="!validAddress" class="mt-2 text-sm text-error">{{ $t('xitcoin_faucet.invalid_address') }}</p>
      <button
        class="btn btn-primary mt-4 w-full disabled:opacity-60"
        :disabled="!ready || !validAddress || !address || pending"
        @click="claim"
      >
        <span v-if="pending" class="loading loading-spinner loading-sm"></span>
        {{ $t('xitcoin_faucet.request') }}
      </button>
      <div class="mt-4 rounded-md bg-base-200 p-3 text-sm text-base-content/80" aria-live="polite">{{ message }}</div>
      <p class="mt-3 text-xs text-base-content/60">
        {{ $t('xitcoin_faucet.policy') }}
      </p>
    </div>
  </div>
</template>
