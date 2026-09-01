<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { suggestChain } from '@leapwallet/cosmos-snap-provider';
import {
  useDashboard,
  useBlockchain,
} from '@/stores';
import type { ChainConfig } from '@/types/chaindata';
import { NetworkType } from '@/types/chaindata';
import { CosmosRestClient } from '@/libs/client';
import AdBanner from '@/components/ad/AdBanner.vue';

const error = ref('');
const conf = ref('');
const pageRevision = 'xitcoin-testnet-wallet-helper-v2';
const dashboard = useDashboard();
const selected = ref({} as ChainConfig);
const wallet = ref('keplr');
const network = ref(NetworkType.Testnet);
const mainnet = ref([] as ChainConfig[]);
const testnet = ref([] as ChainConfig[]);
const chains = computed(() => {
  return network.value === NetworkType.Mainnet ? mainnet.value : testnet.value;
});

onMounted(async () => {
  const chainStore = useBlockchain();
  const [mainnetConfig, testnetConfig] = await Promise.all([
    dashboard.loadLocalConfig(NetworkType.Mainnet),
    dashboard.loadLocalConfig(NetworkType.Testnet),
  ]);

  mainnet.value = Object.values<ChainConfig>(mainnetConfig);
  testnet.value = Object.values<ChainConfig>(testnetConfig);

  const current = chainStore.current;
  const currentTestnet = current && testnet.value.find((chain) => chain.chainName === current.chainName);
  const currentMainnet = current && mainnet.value.find((chain) => chain.chainName === current.chainName);

  if (currentTestnet) {
    network.value = NetworkType.Testnet;
    selected.value = currentTestnet;
  } else if (currentMainnet) {
    network.value = NetworkType.Mainnet;
    selected.value = currentMainnet;
  } else if (testnet.value.length > 0) {
    network.value = NetworkType.Testnet;
    selected.value = testnet.value[0];
  } else if (mainnet.value.length > 0) {
    network.value = NetworkType.Mainnet;
    selected.value = mainnet.value[0];
  }

  await onchange();
});

async function changeNetwork() {
  selected.value = chains.value[0] || ({} as ChainConfig);
  await onchange();
}

async function onchange() {
  error.value = '';
  if (!selected.value?.chainName) {
    conf.value = '';
    return;
  }

  try {
    wallet.value === 'keplr' ? await initParamsForKeplr() : await initSnap();
  } catch (cause) {
    conf.value = '';
    error.value = cause instanceof Error ? cause.message : 'Unable to load wallet parameters';
  }
}

async function initParamsForKeplr() {
  const chain = selected.value;
  if (!chain.endpoints?.rest?.at(0)) throw new Error('REST endpoint is not configured');
  const client = CosmosRestClient.newDefault(chain.endpoints.rest?.at(0)?.address || '');
  const b = await client.getBaseBlockLatest();
  const chainid = b.block.header.chain_id;

  const gasPriceStep = chain.keplrPriceStep || {
    low: 0.01,
    average: 0.025,
    high: 0.03,
  };
  const coinDecimals =
    chain.assets[0].denom_units.find((x) => x.denom === chain.assets[0].symbol.toLowerCase())?.exponent || 6;
  conf.value = JSON.stringify(
    {
      chainId: chainid,
      chainName: chain.chainName,
      rpc: chain.endpoints?.rpc?.at(0)?.address,
      rest: chain.endpoints?.rest?.at(0)?.address,
      bip44: {
        coinType: Number(chain.coinType),
      },
      coinType: Number(chain.coinType),
      bech32Config: {
        bech32PrefixAccAddr: chain.bech32Prefix,
        bech32PrefixAccPub: `${chain.bech32Prefix}pub`,
        bech32PrefixValAddr: `${chain.bech32Prefix}valoper`,
        bech32PrefixValPub: `${chain.bech32Prefix}valoperpub`,
        bech32PrefixConsAddr: `${chain.bech32Prefix}valcons`,
        bech32PrefixConsPub: `${chain.bech32Prefix}valconspub`,
      },
      currencies: [
        {
          coinDenom: chain.assets[0].symbol,
          coinMinimalDenom: chain.assets[0].base,
          coinDecimals,
          coinGeckoId: chain.assets[0].coingecko_id || 'unknown',
        },
      ],
      feeCurrencies: [
        {
          coinDenom: chain.assets[0].symbol,
          coinMinimalDenom: chain.assets[0].base,
          coinDecimals,
          coinGeckoId: chain.assets[0].coingecko_id || 'unknown',
          gasPriceStep,
        },
      ],
      gasPriceStep,
      stakeCurrency: {
        coinDenom: chain.assets[0].symbol,
        coinMinimalDenom: chain.assets[0].base,
        coinDecimals,
        coinGeckoId: chain.assets[0].coingecko_id || 'unknown',
      },
      features: chain.keplrFeatures || [],
    },
    null,
    '\t'
  );
}

async function initSnap() {
  const chain = selected.value;
  const [token] = chain.assets;

  if (!chain.endpoints?.rest?.at(0)) throw new Error('REST endpoint is not configured');
  const client = CosmosRestClient.newDefault(chain.endpoints.rest?.at(0)?.address || '');
  const b = await client.getBaseBlockLatest();
  const chainId = b.block.header.chain_id;

  conf.value = JSON.stringify(
    {
      chainId,
      chainName: chain.chainName,
      bech32Config: {
        bech32PrefixAccAddr: chain.bech32Prefix,
      },
      bip44: {
        coinType: Number(chain.coinType),
      },
      feeCurrencies: [
        {
          coinDenom: token.display,
          coinMinimalDenom: token.base,
          coinDecimals: token.denom_units.find((x) => x.denom === token.display)?.exponent || 6,
          coinGeckoId: token.coingecko_id,
          gasPriceStep: {
            low: 0.0625,
            average: 0.5,
            high: 62.5,
          },
        },
      ],
    },
    null,
    '\t'
  );
}

function suggest() {
  error.value = '';
  if (!conf.value) return;

  if (wallet.value === 'keplr') {
    // @ts-ignore
    if (window.keplr) {
      // @ts-ignore
      window.keplr.experimentalSuggestChain(JSON.parse(conf.value)).catch((cause) => {
        error.value = cause instanceof Error ? cause.message : String(cause);
      });
    } else {
      error.value = 'Keplr is not available in this browser';
    }
  } else {
    suggestChain(JSON.parse(conf.value));
  }
}
</script>

<template>
  <div :data-revision="pageRevision" class="rounded bg-base-100 p-4 text-center">
    <div class="grid grid-cols-1 gap-4 text-left md:grid-cols-2">
      <label class="form-control w-full">
        <span class="label-text mb-2">Network</span>
        <select v-model="network" class="select select-bordered w-full" @change="changeNetwork">
          <option :value="NetworkType.Mainnet">Mainnet</option>
          <option :value="NetworkType.Testnet">Testnet</option>
        </select>
      </label>

      <label class="form-control w-full">
        <span class="label-text mb-2">Chain</span>
        <select v-model="selected" class="select select-bordered w-full" @change="onchange">
          <option v-for="c in chains" :key="c.chainName" :value="c">
            {{ c.chainName }}
          </option>
        </select>
      </label>
    </div>

    <div class="mt-4 flex items-center justify-center gap-6">
      <label class="flex cursor-pointer items-center gap-2">
        <input v-model="wallet" type="radio" value="keplr" class="radio radio-bordered" @change="onchange" />
        Keplr
      </label>
      <label class="flex cursor-pointer items-center gap-2">
        <input v-model="wallet" type="radio" value="metamask" class="radio radio-bordered" @change="onchange" />
        Metamask
      </label>
    </div>

    <div class="text-main mt-5">
      <textarea v-model="conf" class="textarea textarea-bordered w-full font-mono text-sm" rows="15" readonly></textarea>
    </div>

    <div v-if="error" class="alert alert-error mt-4 text-left" role="alert">
      {{ error }}
    </div>

    <div class="mb-4 mt-4">
      <button
        class="btn btn-primary mr-2 text-white"
        :disabled="!selected.chainName || !conf"
        @click="suggest"
      >
        Suggest {{ selected.chainName }} to {{ wallet }}
      </button>

      <div class="mt-4 text-sm text-base-content/70">
        If the chain is not officially supported by Keplr or Metamask Snap, submit these parameters to enable it.
      </div>
    </div>

    <AdBanner id="suggest-banner-ad" unit="banner" width="970px" height="90px" />
  </div>
</template>
