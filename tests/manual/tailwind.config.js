/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    '../../packages/*/tests/manual/features/**/*.{html,js,ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
