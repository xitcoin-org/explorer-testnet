<script lang="ts" setup>
import ApexCharts from 'vue3-apexcharts';
import { computed, ref } from '@vue/reactivity';
import { useBaseStore } from '@/stores';

const baseStore = useBaseStore();

const options = computed(() => {
  return {
    chart: {
      type: 'bar',
      height: 150,
    },
    plotOptions: {
      bar: {
        // borderRadius: 4,
        horizontal: false,
      },
    },
    dataLabels: {
      enabled: false,
    },
    colors: ['#5A67D8'],
    xaxis: {
      labels: {
        show: false,
        rotate: -45,
      },
      show: false,
      categories: baseStore.recents
        .slice(0, 50)
        .map((x) => x.block.header.height)
        .concat(Array(Math.max(0, 50)).fill('')),
    },
  };
});
const series = computed(() => {
  return [
    {
      name: 'Txs',
      data: baseStore.recents?.map((x) => x.block.data.txs.length) || [],
    },
  ];
});
</script>

<template>
  <p v-if="baseStore.recents.length && baseStore.recents.every(b => b.block.data.txs.length === 0)" class="bg-base-100 rounded p-4 mb-4">No transactions found in the observed blocks.</p>
  <ApexCharts v-else type="bar" height="150" :options="options" :series="series" />
</template>
