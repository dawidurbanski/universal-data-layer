import defineAppConfig from 'docus';

export default defineAppConfig({
  ui: {
    primary: 'sky',
    gray: 'slate',
    footer: {
      bottom: {
        left: 'text-sm text-gray-500 dark:text-gray-400',
        wrapper: 'border-t border-gray-200 dark:border-gray-800',
      },
    },
  },
  github: {
    rootDir: 'docs',
  },
  seo: {
    siteName: 'Universal Data Layer',
  },
  header: {
    title: 'UDL',
    logo: {
      alt: 'Universal Data Layer',
      light: '',
      dark: '',
    },
    search: true,
    colorMode: true,
    links: [
      {
        icon: 'i-simple-icons-github',
        to: 'https://github.com/dawidurbanski/universal-data-layer',
        target: '_blank',
        'aria-label': 'Universal Data Layer on GitHub',
      },
    ],
  },
  footer: {
    credits: 'Copyright © 2024',
    colorMode: false,
    links: [
      {
        icon: 'i-simple-icons-github',
        to: 'https://github.com/dawidurbanski/universal-data-layer',
        target: '_blank',
        'aria-label': 'Universal Data Layer on GitHub',
      },
    ],
  },
  toc: {
    title: 'On this page',
    links: [
      {
        icon: 'i-lucide-pen',
        label: 'Edit on GitHub',
        to: 'https://github.com/dawidurbanski/universal-data-layer/edit/main/docs/content/:path',
        target: '_blank',
      },
    ],
  },
});
