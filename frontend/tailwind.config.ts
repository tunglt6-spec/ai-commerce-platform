import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef8f3',
          100: '#d8efe4',
          200: '#b5dfcc',
          300: '#88c8ac',
          400: '#55aa86',
          500: '#2f8f6b',
          600: '#227456',
          700: '#1d5d47',
          800: '#194a3a',
          900: '#143d31',
        },
        ink: {
          50: '#f7f8f5',
          100: '#ecefe8',
          200: '#d9ded4',
          300: '#b9c2b1',
          400: '#899684',
          500: '#64705f',
          600: '#4d5749',
          700: '#3f473c',
          800: '#2c342c',
          900: '#121815',
          950: '#090d0b',
        },
        signal: {
          amber: '#d5902b',
          rose: '#bd4b5c',
          blue: '#3a6f8f',
        },
      },
      fontFamily: {
        sans: ['Aptos', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
        mono: ['Cascadia Mono', 'SFMono-Regular', 'Consolas', 'Liberation Mono', 'monospace'],
      },
      boxShadow: {
        card: '0 18px 48px rgba(21, 45, 35, 0.08), 0 1px 1px rgba(21, 45, 35, 0.05)',
        panel: '0 24px 70px rgba(9, 13, 11, 0.14)',
      },
      backgroundImage: {
        grid: 'linear-gradient(rgba(20,61,49,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(20,61,49,.06) 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
};

export default config;
