/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // PWA Theme Colors
        primary: {
          50: '#EFF6FF',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
        },
        'pwa-theme': '#3B82F6',
        'pwa-bg': '#F8FAFC',
        'pwa-surface': '#FFFFFF',
      }
    },
  },
  plugins: [],
}

