import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f1efff',
          100: '#e5e0ff',
          200: '#ccc3ff',
          300: '#ab9cff',
          400: '#8a72fb',
          500: '#6d5dfb',
          600: '#5a45e8',
          700: '#4a37c2',
          800: '#3d2f9c',
          900: '#342b7d',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)',
      },
    },
  },
  plugins: [],
};

export default config;
