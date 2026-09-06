<script lang="ts" setup>
import type { PropType } from 'vue';

const props = defineProps({
  blocks: { type: Array as PropType<{ height: string; color: string }[]> },
});
</script>
<template>
  <div class="flex gap-0.5" role="img" :aria-label="`${blocks?.filter(b => b.color === 'bg-green-500').length || 0} blocs signés, ${blocks?.filter(b => b.color === 'bg-red-500').length || 0} manqués, ${blocks?.filter(b => b.color === 'bg-yellow-500').length || 0} précommits, ${blocks?.filter(b => b.color === 'bg-secondary').length || 0} non observés`">
    <div class="cursor-default" v-for="(item, index) in blocks" :key="index">
      <div class="tooltip" :data-tip="item.height" :class="item.color" style="width: 3px">&nbsp;</div>
    </div>
  </div>
</template>

<style></style>
