<script lang="ts" setup>
import type { PropType } from 'vue';
import { useBlockchain, useFormatter } from '@/stores';
import { formatSeconds } from '@/libs/utils';
import Loading from '@/components/Loading.vue';
import { parameterValue, parameterAssets } from '@/libs/validatorProfile';
const props = defineProps({
  cardItem: {
    type: Object as PropType<{ title: string; items: Array<any> }>,
  },
  loading: { type: Boolean, default: false },
});

const formatter = useFormatter();
function calculateValue(value: unknown, key: string) {
  if (typeof value === 'string' && /^\d+s$/.test(value)) return formatSeconds(value);
  const assets = parameterAssets(useBlockchain().current?.assets || []);
  return parameterValue(value, key, assets);
}

function formatTitle(v: string) {
  if (!v) return '';
  return v.replace(/_/g, ' ');
}
</script>
<template>
  <div
    class="bg-base-100 px-4 pt-3 pb-4 rounded mt-5"
    v-if="props.loading || (props.cardItem?.items && props.cardItem?.items?.length > 0)"
  >
    <div class="text-base mb-3 text-main">{{ props.cardItem?.title }}</div>
    <Loading v-if="props.loading" :bordered="false" />
    <div v-else class="grid grid-cols-2 md:!grid-cols-4 lg:!grid-cols-5 2xl:!grid-cols-6 gap-4">
      <div v-for="(item, index) of props.cardItem?.items" :key="index" class="rounded-sm bg-active px-4 py-2">
        <div class="text-xs mb-2 text-secondary capitalize">{{ formatTitle(item?.subtitle) }}</div>
        <div class="text-base text-main break-words">{{ calculateValue(item?.value, item?.subtitle) }}</div>
      </div>
    </div>
  </div>
</template>
