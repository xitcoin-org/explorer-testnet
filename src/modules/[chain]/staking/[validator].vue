<script setup lang="ts">
import { parseCoins } from '@cosmjs/stargate';
import {
  useBankStore,
  useBlockchain,
  useDistributionStore,
  useFormatter,
  useStakingStore,
  useTxDialog,
} from '@/stores';
import { onMounted, computed, ref } from 'vue';
import { Icon } from '@iconify/vue';
import CommissionRate from '@/components/ValidatorCommissionRate.vue';
import {
  consensusPubkeyToHexAddress,
  operatorAddressToAccount,
  pubKeyToValcons,
  publicValidatorMoniker,
} from '@/libs';
import {
  PageRequest,
  type Coin,
  type Delegation,
  type PaginatedDelegations,
  type PaginatedTxs,
  type Validator,
} from '@/types';
import PaginationBar from '@/components/PaginationBar.vue';
import { fromBase64, toBase64 } from '@cosmjs/encoding';
import { stringToUint8Array, uint8ArrayToString } from '@/libs/utils';

import {
  UNAVAILABLE,
  textValue,
  websiteLink,
  contactLink,
  tokenAmount,
  sharesValue,
  jailedValue,
  unbondingValue,
  estimatedApr,
} from '@/libs/validatorProfile';

const props = defineProps(['validator', 'chain']);

const staking = useStakingStore();
const blockchain = useBlockchain();
const format = useFormatter();
const dialog = useTxDialog();
const page = new PageRequest();

const validator: string = props.validator;

const v = ref({} as Validator);
const cache = JSON.parse(localStorage.getItem('avatars') || '{}');
const avatars = ref(cache || {});
const identity = ref('');
const rewards = ref<Coin[]>();
const commission = ref<Coin[]>();
const delegations = ref({} as PaginatedDelegations);
const addresses = ref(
  {} as {
    account: string;
    operAddress: string;
    hex: string;
    valCons: string;
  }
);
const selfBonded = ref({} as Delegation);

addresses.value.account = operatorAddressToAccount(validator);
// load self bond
staking
  .fetchValidatorDelegation(validator, addresses.value.account)
  .then((x) => {
    if (x) {
      selfBonded.value = x.delegation_response;
    }
  });

const txs = ref({} as PaginatedTxs);

blockchain.rpc.getTxsBySender(addresses.value.account).then((x) => {
  txs.value = x;
});

const inflation = ref<unknown>();
// Read the API directly: the shared mint store uses a synthetic zero on failure.
blockchain.rpc
  .getMintInflation()
  .then((res) => {
    inflation.value = res?.inflation;
  })
  .catch(() => {
    inflation.value = undefined;
  });
const apr = computed(() => {
  const supply = useBankStore().supply;
  if (supply.denom !== staking.params.bond_denom) return UNAVAILABLE;
  return estimatedApr(
    inflation.value,
    useDistributionStore().params.community_tax,
    v.value.commission?.commission_rates?.rate,
    staking.pool.bonded_tokens,
    supply.amount
  );
});
const asset = computed(() => {
  const entry = blockchain.current?.assets.find(
    (a) => a.base === staking.params.bond_denom
  );
  const unit = entry?.denom_units.find(
    (u) => u.denom.toLowerCase() === entry.display.toLowerCase()
  );
  return entry && unit
    ? { base: entry.base, symbol: entry.symbol, exponent: unit.exponent }
    : undefined;
});
const amount = (value: unknown) =>
  tokenAmount(value, staking.params.bond_denom, asset.value);
const minimumSelfDelegation = computed(() =>
  amount(v.value.min_self_delegation)
);
const website = computed(() => textValue(v.value.description?.website));
const contact = computed(() =>
  textValue(v.value.description?.security_contact)
);

const logo = (identity?: string) => {
  if (blockchain.chainName === 'xitcoin-testnet') return '/assets/validator-fallback.svg';
  if (!identity) return '';
  const url = avatars.value[identity] || '';
  return url.startsWith('http')
    ? url
    : `https://s3.amazonaws.com/keybase_processed_uploads/${url}`;
};

const fetchAvatar = (identity: string) => {
  // fetch avatar from keybase
  return new Promise<void>((resolve) => {
    staking
      .keybase(identity)
      .then((d) => {
        if (Array.isArray(d.them) && d.them.length > 0) {
          const uri = String(d.them[0]?.pictures?.primary?.url).replace(
            'https://s3.amazonaws.com/keybase_processed_uploads/',
            ''
          );

          avatars.value[identity] = uri;
          resolve();
        } else throw new Error(`failed to fetch avatar for ${identity}.`);
      })
      .catch((error) => {
        // console.error(error); // uncomment this if you want the user to see if the avatar failed to load.
        resolve();
      });
  });
};

const loadAvatar = (identity: string) => {
  // fetches avatar from keybase and stores it in localStorage
  fetchAvatar(identity).then(() => {
    localStorage.setItem('avatars', JSON.stringify(avatars.value));
  });
};

onMounted(() => {
  if (validator) {
    staking.fetchValidator(validator).then((res) => {
      v.value = res.validator;
      identity.value = textValue(res.validator?.description?.identity) || '';
      if (identity.value && !avatars.value[identity.value])
        loadAvatar(identity.value);

      addresses.value.hex = consensusPubkeyToHexAddress(
        v.value.consensus_pubkey
      );
      addresses.value.valCons = pubKeyToValcons(
        v.value.consensus_pubkey,
        blockchain.current?.bech32ConsensusPrefix || ''
      );
    });
    blockchain.rpc
      .getDistributionValidatorOutstandingRewards(validator)
      .then((res) => {
        rewards.value = res.rewards?.rewards?.sort(
          (a, b) => Number(b.amount) - Number(a.amount)
        );
        res.rewards?.rewards?.forEach((x) => {
          if (x.denom.startsWith('ibc/')) {
            format.fetchDenomTrace(x.denom);
          }
        });
      });
    blockchain.rpc.getDistributionValidatorCommission(validator).then((res) => {
      commission.value = res.commission?.commission?.sort(
        (a, b) => Number(b.amount) - Number(a.amount)
      );
      res.commission?.commission?.forEach((x) => {
        if (x.denom.startsWith('ibc/')) {
          format.fetchDenomTrace(x.denom);
        }
      });
    });

    // Disable delegations due to its bad performance
    // Comment out the following code if you want to enable it
    // pageload(1)
  }
});
let showCopyToast = ref(0);
const copyWebsite = async (url: string) => {
  if (!url) {
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    showCopyToast.value = 1;
    setTimeout(() => {
      showCopyToast.value = 0;
    }, 1000);
  } catch (err) {
    showCopyToast.value = 2;
    setTimeout(() => {
      showCopyToast.value = 0;
    }, 1000);
  }
};
const tipMsg = computed(() => {
  return showCopyToast.value === 2
    ? { class: 'error', msg: 'Copy Error!' }
    : { class: 'success', msg: 'Copy Success!' };
});

function pageload(p: number) {
  page.setPage(p);
  page.limit = 10;

  blockchain.rpc
    .getStakingValidatorsDelegations(validator, page)
    .then((res) => {
      delegations.value = res;
    });
}

const events = ref({} as PaginatedTxs);

enum EventType {
  Delegate = 'delegate',
  Unbond = 'unbond',
}

const selectedEventType = ref(EventType.Delegate);

function loadPowerEvents(p: number, type: EventType) {
  selectedEventType.value = type;
  page.setPage(p);
  page.setPageSize(5);
  blockchain.rpc
    .getTxs(
      "?order_by=2&events={type}.validator='{validator}'",
      { type: selectedEventType.value, validator },
      page
    )
    .then((res) => {
      events.value = res;
    });
}

function pagePowerEvents(page: number) {
  loadPowerEvents(page, selectedEventType.value);
}

pagePowerEvents(1);

function mapEvents(
  events: { type: string; attributes: { key: string; value: string }[] }[]
) {
  const attributes = events
    .filter((x) => x.type === selectedEventType.value)
    .filter(
      (x) =>
        x.attributes.findIndex(
          (attr) =>
            attr.value === validator ||
            attr.value === toBase64(stringToUint8Array(validator))
        ) > -1
    )
    .map((x) => {
      // check if attributes need to decode
      const output = {} as { [key: string]: string };

      if (x.attributes.findIndex((a) => a.key === `amount`) > -1) {
        x.attributes.forEach((attr) => {
          output[attr.key] = attr.value;
        });
      } else {
        x.attributes.forEach((attr) => {
          output[uint8ArrayToString(fromBase64(attr.key))] = uint8ArrayToString(
            fromBase64(attr.value)
          );
        });
      }

      return output;
    });

  const coinsAsString = attributes.map((x: any) => x.amount).join(',');
  const coins = parseCoins(coinsAsString);

  return coins.map((coin) => format.formatToken(coin)).join(', ');
}

function mapDelegators(messages: any[]) {
  if (!messages) return [];
  return Array.from(
    new Set(messages.map((x) => x.delegator_address || x.grantee))
  );
}
</script>
<template>
  <div class="validator-profile">
    <div class="bg-base-100 px-4 pt-3 pb-4 rounded shadow border-indigo-500">
      <div class="flex flex-col lg:!flex-row pt-2 pb-1">
        <div class="flex-1">
          <div class="flex">
            <div
              class="avatar mr-4 relative h-24 w-24 shrink-0 rounded-full overflow-hidden"
            >
              <div class="absolute h-24 w-24 rounded-full opacity-10"></div>
              <div class="h-24 w-24 rounded-full overflow-hidden">
                <img
                  v-if="logo(identity)"
                  :src="logo(identity)" alt="Validator avatar"
                  class="h-24 w-24 rounded-full object-cover"
                  @error="
                    (e) => {
                      (e.target as HTMLImageElement).src = '/assets/validator-fallback.svg';
                    }
                  "
                />
                <Icon
                  v-else
                  class="text-8xl"
                  :icon="`mdi-help-circle-outline`"
                />
              </div>
            </div>
            <div class="mx-2">
              <h4>
                {{
                  publicValidatorMoniker(
                    v.description?.moniker,
                    blockchain.chainName
                  )
                }}
              </h4>
              <div v-if="v.description?.identity" class="text-sm mb-4">
                {{ v.description.identity }}
              </div>
              <button type="button"

                class="btn btn-primary btn-sm w-full"
                @click="
                  dialog.open('delegate', {
                    validator_address: v.operator_address,
                  })
                "
                >{{ $t('account.btn_delegate') }}</button>
            </div>
          </div>
          <div class="m-4 text-sm">
            <p class="text-sm mb-3 font-medium">{{ $t('staking.about_us') }}</p>
            <div class="card-list">
              <div class="flex items-center mb-2">
                <Icon icon="mdi-web" class="text-xl mr-1" />
                <span class="font-bold mr-2"
                  >{{ $t('staking.website') }}:
                </span>
                <a
                  v-if="websiteLink(website)"
                  :href="websiteLink(website)"
                  class="cursor-pointer"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {{ website }}
                </a>
                <span v-else>{{ website || UNAVAILABLE }}</span>
              </div>
              <div class="flex items-center">
                <Icon icon="mdi-email-outline" class="text-xl mr-1" />
                <span class="font-bold mr-2"
                  >{{ $t('staking.contact') }}:
                </span>
                <a
                  v-if="contactLink(contact)"
                  :href="contactLink(contact)"
                  class="cursor-pointer"
                >
                  {{ contact }}
                </a>
                <span v-else>{{ contact || UNAVAILABLE }}</span>
              </div>
            </div>
            <p class="text-sm mt-4 mb-3 font-medium">
              {{ $t('staking.validator_status') }}
            </p>
            <div class="card-list">
              <div class="flex items-center mb-2">
                <Icon icon="mdi-shield-account-outline" class="text-xl mr-1" />
                <span class="font-bold mr-2">{{ $t('staking.status') }}: </span
                ><span>
                  {{
                    v.status
                      ? String(v.status).replace('BOND_STATUS_', '')
                      : UNAVAILABLE
                  }}
                </span>
              </div>
              <div class="flex items-center">
                <Icon icon="mdi-shield-alert-outline" class="text-xl mr-1" />
                <span class="font-bold mr-2">{{ $t('staking.jailed') }}: </span>
                <span>{{ jailedValue(v.jailed) }}</span>
              </div>
            </div>
            <p class="text-sm mt-4 mb-3 font-medium">
              {{ $t('staking.liquid_staking') }}
            </p>
            <p v-if="v.validator_bond_shares === undefined && v.liquid_shares === undefined" class="text-sm mb-3">Non disponible : l’API de cette chaîne ne fournit pas les parts de liquid staking.</p>
            <div class="card-list">
              <div class="flex items-center mb-2">
                <Icon icon="mdi-lock" class="text-xl mr-1" />
                <span class="font-bold mr-2"
                  >Validator Bonded Shares:
                </span>
                <span :title="v.validator_bond_shares">
                  {{ sharesValue(v.validator_bond_shares) }}
                </span>
              </div>
              <div class="flex items-center">
                <Icon icon="mdi-waves-arrow-right" class="text-xl mr-1" />
                <span class="font-bold mr-2"
                  >{{ $t('staking.liquid_staking_shares') }}:
                </span>
                <span :title="v.liquid_shares">
                  {{ sharesValue(v.liquid_shares) }}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div class="flex-1">
          <div class="flex flex-col mt-10">
            <div class="flex mb-2">
              <div
                class="flex items-center justify-center rounded w-10 h-10"
                style="border: 1px solid #666"
              >
                <Icon icon="mdi-coin" class="text-3xl" />
              </div>
              <div class="ml-3 flex flex-col justify-center">
                <h4>
                  {{ amount(v.tokens) }}
                </h4>
                <span class="text-sm">Validator Tokens</span>
              </div>
            </div>
            <div class="flex mb-2">
              <div
                class="flex items-center justify-center rounded w-10 h-10"
                style="border: 1px solid #666"
              >
                <Icon icon="mdi-percent" class="text-3xl" />
              </div>
              <div class="ml-3 flex flex-col justify-center">
                <h4>{{ amount(selfBonded.balance?.amount) }}</h4>
                <span class="text-sm">{{ $t('staking.self_bonded') }}</span>
              </div>
            </div>

            <div class="flex mb-2">
              <div
                class="flex items-center justify-center rounded w-10 h-10"
                style="border: 1px solid #666"
              >
                <Icon icon="mdi-account-tie" class="text-3xl" />
              </div>

              <div class="ml-3 flex flex-col">
                <h4>{{ minimumSelfDelegation }}</h4>
                <span class="text-sm">{{ $t('staking.min_self') }}</span>
              </div>
            </div>
            <div class="flex mb-2">
              <div
                class="flex items-center justify-center rounded w-10 h-10"
                style="border: 1px solid #666"
              >
                <Icon icon="mdi-finance" class="text-3xl" />
              </div>
              <div class="ml-3 flex flex-col justify-center">
                <h4>{{ apr }}</h4>
                <span class="text-sm"
                  >Annual Profit — APR estimé (émission)</span
                >
                <p class="text-xs mt-1 max-w-sm">Estimation à paramètres constants, après taxe communautaire et commission. Hors frais et capitalisation ; aucun rendement garanti.</p>
              </div>
            </div>

            <div class="flex mb-2">
              <div
                class="flex items-center justify-center rounded w-10 h-10"
                style="border: 1px solid #666"
              >
                <Icon
                  icon="mdi:arrow-down-bold-circle-outline"
                  class="text-3xl"
                />
              </div>
              <div class="ml-3 flex flex-col justify-center">
                <h4>
                  {{ unbondingValue(v.status, v.unbonding_height, 'height') }}
                </h4>
                <span class="text-sm">{{
                  $t('staking.unbonding_height')
                }}</span>
              </div>
            </div>

            <div class="flex mb-2">
              <div
                class="flex items-center justify-center rounded w-10 h-10"
                style="border: 1px solid #666"
              >
                <Icon icon="mdi-clock" class="text-3xl" />
              </div>
              <div class="ml-3 flex flex-col justify-center">
                <h4>
                  {{ unbondingValue(v.status, v.unbonding_time, 'time') }}
                </h4>
                <span class="text-sm">{{ $t('staking.unbonding_time') }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="text-sm px-4 pt-3 border-t">
        {{ textValue(v.description?.details) || UNAVAILABLE }}
      </div>
    </div>

    <div class="mt-3 grid grid-cols-1 md:!grid-cols-3 gap-4">
      <div>
        <CommissionRate
          v-if="v.commission?.commission_rates"
          :commission="v.commission"
        ></CommissionRate>
        <p v-else>{{ UNAVAILABLE }}</p>
      </div>
      <div class="bg-base-100 rounded shadow relative overflow-auto">
        <div class="text-lg font-semibold text-main px-4 pt-4">
          {{ $t('staking.commissions_&_rewards') }}
        </div>
        <div
          class="px-4 mt-1 flex flex-col justify-between pb-4 max-h-72"
          style="height: calc(100% - 50px)"
        >
          <div tabindex="0" role="region" aria-label="Commissions et récompenses" class="overflow-auto flex-1">
            <div class="text-sm mb-2">{{ $t('staking.commissions') }}</div>
            <div
              v-for="(i, k) in commission"
              :key="`reward-${k}`"
              color="info"
              label
              variant="outlined"
              class="mr-1 mb-1 badge text-xs"
            >
              {{ format.formatToken2(i) }}
            </div>
            <p v-if="!commission?.length">
              {{ commission ? 'Aucune commission' : UNAVAILABLE }}
            </p>
            <div class="text-sm mb-2 mt-2">
              {{ $t('staking.outstanding') }} {{ $t('account.rewards') }}
            </div>
            <div
              v-for="(i, k) in rewards"
              :key="`reward-${k}`"
              class="mr-1 mb-1 badge text-xs"
            >
              {{ format.formatToken2(i) }}
            </div>
            <p v-if="!rewards?.length">
              {{ rewards ? 'Aucune récompense' : UNAVAILABLE }}
            </p>
          </div>
          <div class="">
            <button type="button"
              class="btn btn-primary w-full"
              @click="
                dialog.open('withdraw_commission', {
                  validator_address: v.operator_address,
                })
              "
              >{{ $t('account.btn_withdraw') }}</button>
          </div>
        </div>
      </div>
      <div class="bg-base-100 rounded shadow overflow-x-auto">
        <div class="px-4 pt-4 mb-2 text-main font-lg font-semibold">
          {{ $t('staking.addresses') }}
        </div>
        <div class="px-4 pb-4">
          <div class="mb-3">
            <div class="text-sm flex">
              {{ $t('staking.account_addr') }}
              <Icon
                icon="mdi:content-copy"
                class="ml-2 cursor-pointer"
                v-show="addresses.account"
                @click="copyWebsite(addresses.account || '')"
              />
            </div>
            <RouterLink
              class="text-xs text-primary"
              :to="`/${chain}/account/${addresses.account}`"
            >
              {{ addresses.account }}
            </RouterLink>
          </div>
          <div class="mb-3">
            <div class="text-sm flex">
              {{ $t('staking.operator_addr') }}
              <Icon
                icon="mdi:content-copy"
                class="ml-2 cursor-pointer"
                v-show="v.operator_address"
                @click="copyWebsite(v.operator_address || '')"
              />
            </div>
            <div class="text-xs">
              {{ v.operator_address }}
            </div>
          </div>
          <div class="mb-3">
            <div class="text-sm flex">
              {{ $t('staking.hex_addr') }}
              <Icon
                icon="mdi:content-copy"
                class="ml-2 cursor-pointer"
                v-show="addresses.hex"
                @click="copyWebsite(addresses.hex || '')"
              />
            </div>
            <div class="text-xs">{{ addresses.hex }}</div>
          </div>
          <div class="mb-3">
            <div class="text-sm flex">
              {{ $t('staking.signer_addr') }}
              <Icon
                icon="mdi:content-copy"
                class="ml-2 cursor-pointer"
                v-show="addresses.valCons"
                @click="copyWebsite(addresses.valCons || '')"
              />
            </div>
            <div class="text-xs">{{ addresses.valCons }}</div>
          </div>
          <div>
            <div class="text-sm flex">
              {{ $t('staking.consensus_pub_key') }}
              <Icon
                icon="mdi:content-copy"
                class="ml-2 cursor-pointer"
                v-show="v.consensus_pubkey"
                @click="copyWebsite(JSON.stringify(v.consensus_pubkey) || '')"
              />
            </div>
            <div class="text-xs">{{ v.consensus_pubkey }}</div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="delegations.delegation_responses"
      class="mt-5 bg-base-100 shadow rounded p-4"
    >
      <div class="text-lg mb-4 font-semibold">
        {{ $t('account.delegations') }}
        <span class="float-right">
          {{ delegations.delegation_responses?.length || 0 }} /
          {{ delegations.pagination?.total || 0 }}
        </span>
      </div>
      <div tabindex="0" role="region" aria-label="Tableau du validateur" class="rounded overflow-auto">
        <table class="table validatore-table w-full" aria-label="Délégations du validateur">
          <thead><tr>
            <th class="text-left pl-4" style="position: relative; z-index: 2">
              {{ $t('account.delegator') }}
            </th>
            <th class="text-left pl-4">{{ $t('account.delegation') }}</th>
          </tr></thead>
          <tbody>
<tr v-if="!delegations.delegation_responses?.length"><td colspan="2" class="p-4">{{ delegations.delegation_responses ? 'Aucune délégation.' : 'Non disponible' }}</td></tr>
            <tr
              v-for="{
                balance,
                delegation,
              } in delegations.delegation_responses"
            >
              <td class="text-sm text-primary">
                {{ delegation.delegator_address }}
              </td>
              <td class="truncate text-primary">
                {{ format.formatToken(balance) }}
              </td>
            </tr>
          </tbody>
        </table>
        <PaginationBar
          :total="delegations.pagination?.total"
          :limit="page.limit"
          :callback="pageload"
        />
      </div>
    </div>

    <div class="mt-5 bg-base-100 shadow rounded p-4">
      <div class="text-lg mb-4 font-semibold">
        {{ $t('account.transactions') }}
      </div>
      <div tabindex="0" role="region" aria-label="Tableau du validateur" class="rounded overflow-auto">
        <table class="table validatore-table w-full" aria-label="Transactions du validateur">
          <thead><tr>
            <th class="text-left pl-4" style="position: relative; z-index: 2">
              {{ $t('account.height') }}
            </th>
            <th class="text-left pl-4">{{ $t('account.hash') }}</th>
            <th class="text-left pl-4" width="40%">
              {{ $t('account.messages') }}
            </th>
            <th class="text-left pl-4">{{ $t('account.time') }}</th>
          </tr></thead>
          <tbody>
<tr v-if="!txs.tx_responses?.length"><td colspan="4" class="p-4">{{ txs.tx_responses ? 'Aucune transaction pour ce validateur.' : 'Non disponible' }}</td></tr>
            <tr v-for="(item, i) in txs.tx_responses">
              <td class="text-sm text-primary">
                <RouterLink :to="`/${props.chain}/block/${item.height}`">{{
                  item.height
                }}</RouterLink>
              </td>
              <td class="truncate text-primary" style="max-width: 200px">
                <RouterLink :to="`/${props.chain}/tx/${item.txhash}`">
                  {{ item.txhash }}
                </RouterLink>
              </td>
              <td>
                <div class="flex items-center">
                  <span class="mr-2">{{
                    format.messages(item.tx.body.messages)
                  }}</span>
                  <Icon
                    v-if="item.code === 0"
                    icon="mdi-check"
                    class="text-yes"
                  />
                  <Icon v-else icon="mdi-multiply" class="text-no" />
                </div>
              </td>
              <td width="150">{{ format.toDay(item.timestamp, 'from') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="mt-5 bg-base-100 shadow rounded p-4">
      <div class="text-lg mb-4 font-semibold">
        <div class="tabs tabs-boxed bg-transparent">
          <span class="mr-10">Voting Power Events: </span>
          <button type="button"
            class="tab text-base-content/60"
            :class="{ 'tab-active': selectedEventType === EventType.Delegate }"
            @click="loadPowerEvents(1, EventType.Delegate)"
            >{{ $t('account.btn_delegate') }}</button>
          <button type="button"
            class="tab text-base-content/60"
            :class="{ 'tab-active': selectedEventType === EventType.Unbond }"
            @click="loadPowerEvents(1, EventType.Unbond)"
            >{{ $t('account.btn_unbond') }}</button>
        </div>
      </div>
      <div tabindex="0" role="region" aria-label="Tableau du validateur" class="rounded overflow-auto">
        <table class="table validatore-table w-full" aria-label="Événements de voting power">
          <thead><tr>
            <th class="text-left pl-4">{{ $t('account.delegator') }}</th>
            <th class="text-left pl-4">{{ $t('account.amount') }}</th>
            <th class="text-left pl-4">
              {{ $t('account.height') }} / {{ $t('account.time') }}
            </th>
          </tr></thead>
          <tbody>
<tr v-if="!events.tx_responses?.length"><td colspan="3" class="p-4">{{ events.tx_responses ? 'Aucun événement de voting power pour ce filtre.' : 'Non disponible' }}</td></tr>
            <tr v-for="(item, i) in events.tx_responses">
              <td class="pr-2 truncate text-primary" style="max-width: 250px">
                <RouterLink
                  v-for="d in mapDelegators(item.tx?.body?.messages)"
                  :to="`/${props.chain}/account/${d}`"
                >
                  {{ d }}
                </RouterLink>
              </td>
              <td>
                <div
                  class="flex items-center"
                  :class="{
                    'text-yes': selectedEventType === EventType.Delegate,
                    'text-no': selectedEventType === EventType.Unbond,
                  }"
                >
                  <RouterLink :to="`/${props.chain}/tx/${item.txhash}`">
                    <span class="mr-2">
                      {{ selectedEventType === EventType.Delegate ? '+' : '-' }}
                      {{ mapEvents(item.events) }}</span
                    >
                  </RouterLink>
                  <Icon
                    v-if="item.code === 0"
                    icon="mdi-check"
                    class="text-yes"
                  />
                  <Icon v-else icon="mdi-multiply" class="text-no" />
                </div>
              </td>
              <td width="150">
                <RouterLink
                  class="text-primary mb-0"
                  :to="`/${props.chain}/block/${item.height}`"
                  >{{ item.height }}</RouterLink
                ><br />
                <span class="text-xs pt-0 mt-0">{{
                  format.toDay(item.timestamp, 'from')
                }}</span>
              </td>
            </tr>
          </tbody>
        </table>
        <PaginationBar
          :total="events.pagination?.total"
          :limit="page.limit"
          :callback="pagePowerEvents"
        />
      </div>
    </div>
    <!-- end -->
    <div class="toast" v-show="showCopyToast === 1">
      <div class="alert alert-success">
        <div class="text-xs md:!text-sm">
          <span>{{ tipMsg.msg }}</span>
        </div>
      </div>
    </div>
    <div class="toast" v-show="showCopyToast === 2">
      <div class="alert alert-error">
        <div class="text-xs md:!text-sm">
          <span>{{ tipMsg.msg }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.validator-profile {
  overflow-wrap: anywhere;
}
.validator-profile .flex-1 {
  min-width: 0;
}
.validatore-table.table :where(th, td) {
  padding: 0.6rem 1rem;
  font-size: 14px;
}
</style>
