<script lang="ts" setup>
import type { PropType } from 'vue';

const props = defineProps({
  blocks: { type: Array as PropType<{ height: string; color: string }[]> },
});
</script>
<template>
  <div class="flex gap-0.5" role="img" :aria-label="`${blocks?.filter(b => b.color === 'bg-green-500').length || 0} blocks signed, ${blocks?.filter(b => b.color === 'bg-red-500').length || 0} missed, ${blocks?.filter(b => b.color === 'bg-yellow-500').length || 0} precommits, ${blocks?.filter(b => b.color === 'bg-secondary').length || 0} not observed`">
    <div class="cursor-default" v-for="(item, index) in blocks" :key="index">
      <div class="tooltip" :data-tip="item.height" :class="item.color" style="width: 3px">&nbsp;</div>
    </div>
  </div>
</template>

<style></style>
