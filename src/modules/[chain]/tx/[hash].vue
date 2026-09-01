<script lang="ts" setup>
import { useBlockchain, useFormatter } from '@/stores';
import DynamicComponent from '@/components/dynamic/DynamicComponent.vue';
import { computed, ref, watch } from 'vue';
import type { Tx, TxResponse } from '@/types';
import JsonTree from '@/components/JsonTree.vue';

const props = defineProps(['hash', 'chain']);
const blockchain = useBlockchain();
const format = useFormatter();
const loading = ref(false);
const loadError = ref('');
const tx = ref(
  {} as {
    tx: Tx;
    tx_response: TxResponse;
  }
);

async function loadTransaction(hash: string) {
  loading.value = true;
  loadError.value = '';
  tx.value = {} as { tx: Tx; tx_response: TxResponse };
  try {
    tx.value = await blockchain.rpc.getTx(hash);
  } catch {
    loadError.value = 'The transaction could not be loaded. Please try again.';
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.hash,
  (hash) => {
    if (hash) void loadTransaction(hash);
  },
  { immediate: true }
);

const messages = computed(() => {
  return (
    tx.value.tx?.body?.messages.map((x) => {
      if (x.packet?.data) {
        // @ts-ignore
        x.message = format.base64ToString(x.packet.data);
      }
      return x;
    }) || []
  );
});
</script>

<template>
  <div>
    <div v-if="loading" class="mb-4 flex min-h-40 items-center justify-center rounded bg-base-100 p-6 shadow">
      <span class="loading loading-spinner loading-md text-primary"></span>
      <span class="ml-3">Loading transaction…</span>
    </div>

    <div v-else-if="loadError" class="alert alert-error mb-4">
      <div>
        <p>{{ loadError }}</p>
        <p class="mt-1 break-all text-xs">{{ props.hash }}</p>
      </div>
      <button class="btn btn-sm" type="button" @click="loadTransaction(props.hash)">Retry</button>
    </div>

    <div v-if="tx.tx_response" class="bg-base-100 px-4 pt-3 pb-4 rounded shadow mb-4">
      <h2 class="card-title truncate mb-2">{{ $t('tx.title') }}</h2>
      <div class="overflow-hidden">
        <table class="table text-sm">
          <tbody>
            <tr>
              <td>{{ $t('tx.tx_hash') }}</td>
              <td class="overflow-hidden break-all">{{ tx.tx_response.txhash }}</td>
            </tr>
            <tr>
              <td>{{ $t('account.height') }}</td>
              <td>
                <RouterLink :to="`/${props.chain}/block/${tx.tx_response.height}`" class="text-primary"
                  >{{ tx.tx_response.height }}
                </RouterLink>
              </td>
            </tr>
            <tr>
              <td>{{ $t('staking.status') }}</td>
              <td>
                <span
                  class="text-xs truncate relative py-2 px-4 w-fit mr-2 rounded"
                  :class="`text-${tx.tx_response.code === 0 ? 'success' : 'error'}`"
                >
                  <span
                    class="inset-x-0 inset-y-0 opacity-10 absolute"
                    :class="`bg-${tx.tx_response.code === 0 ? 'success' : 'error'}`"
                  ></span>
                  {{ tx.tx_response.code === 0 ? 'Success' : 'Failed' }}
                </span>
                <span>
                  {{ tx.tx_response.code === 0 ? '' : tx?.tx_response?.raw_log }}
                </span>
              </td>
            </tr>
            <tr>
              <td>{{ $t('account.time') }}</td>
              <td>
                {{ format.toLocaleDate(tx.tx_response.timestamp) }} ({{
                  format.toDay(tx.tx_response.timestamp, 'from')
                }})
              </td>
            </tr>
            <tr>
              <td>{{ $t('tx.gas') }}</td>
              <td>{{ tx.tx_response.gas_used }} / {{ tx.tx_response.gas_wanted }}</td>
            </tr>
            <tr>
              <td>{{ $t('tx.fee') }}</td>
              <td>
                {{ format.formatTokens(tx.tx?.auth_info?.fee?.amount, true, '0,0.[00]') }}
              </td>
            </tr>
            <tr>
              <td>{{ $t('tx.memo') }}</td>
              <td>{{ tx.tx.body.memo }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="tx.tx_response" class="bg-base-100 px-4 pt-3 pb-4 rounded shadow mb-4">
      <h2 class="card-title truncate mb-2">{{ $t('account.messages') }}: ({{ messages.length }})</h2>
      <div v-for="(msg, i) in messages" :key="i">
        <div class="border border-slate-400 rounded-md mt-4">
          <DynamicComponent :value="msg" />
        </div>
      </div>
      <div v-if="messages.length === 0">{{ $t('tx.no_messages') }}</div>
    </div>

    <div v-if="tx.tx_response" class="bg-base-100 px-4 pt-3 pb-4 rounded shadow">
      <h2 class="card-title truncate mb-2">JSON</h2>
      <JsonTree :data="tx" :deep="2" :height="480" virtual />
    </div>
  </div>
</template>
