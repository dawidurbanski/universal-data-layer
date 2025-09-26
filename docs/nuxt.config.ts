import { defineNuxtConfig } from 'nuxt/config';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  site: {
    url: 'https://udl.dev',
    name: 'Universal Data Layer',
    description:
      'A modular, high-performance intermediate data layer for universal data sourcing',
  },
  css: ['@/assets/css/main.css'],
  llms: {
    domain: 'https://udl.dev',
    title: 'Universal Data Layer',
    description:
      'A modular, high-performance intermediate data layer for universal data sourcing',
    full: {
      title: 'Universal Data Layer',
      description:
        'A modular, high-performance intermediate data layer for universal data sourcing',
    },
  },
});
