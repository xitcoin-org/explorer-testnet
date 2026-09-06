import { walletImageFallback } from '@/libs/explorerPresentation';
// import 'ping-widget';
import App from '@/App.vue';
import i18n from '@/plugins/i18n';
import '@/style.css';
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import LazyLoad from 'lazy-load-vue3';

import router from './router';

// Optional external wallet artwork must never leave a broken image.
document.addEventListener('error', (event) => {
  const img = event.target;
  if (img instanceof HTMLImageElement) walletImageFallback(img);
}, true);

// Create vue app
const app = createApp(App);
// Use plugins
app.use(i18n);
app.use(createPinia());
app.use(router);
app.use(LazyLoad, { component: true });
// Mount vue app
app.mount('#app');


