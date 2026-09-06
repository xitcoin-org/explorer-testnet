<script lang="ts" setup>
import { useTxDialog, useBlockchain } from '@/stores';
import XitcoinTxDialog from './XitcoinTxDialog.vue';
const store = useTxDialog();
const chainStore = useBlockchain();
</script>
<template>
  <XitcoinTxDialog v-if="chainStore.chainName === 'xitcoin-testnet' && ['send', 'delegate'].includes(store.type)" />
  <ping-tx-dialog v-else
    :type="store.type"
    :sender="store.sender"
    :endpoint="store.endpoint"
    :params="store.params"
    :hd-path="store.hdPaths"
    :registry-name="chainStore.current?.prettyName || chainStore.chainName"
    @view="store.view"
    @confirmed="store.confirmed"
  ></ping-tx-dialog>
</template>
