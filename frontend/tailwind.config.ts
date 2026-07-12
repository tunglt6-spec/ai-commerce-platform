import type { Config } from 'tailwindcss';

/**
 * UI-VISUAL-REFRESH-ALL-PLATFORMS-001 — one shared design system.
 * Token NAMES are unchanged (brand / ink / signal) so every existing component
 * re-themes centrally; only their VALUES change: brand → purple primary,
 * ink → clean slate neutrals, signal → semantic. Plus semantic/accent tokens
 * and gradients for accent areas.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary — purple
        brand: {
          50: '#F5F3FF', // primary soft
          100: '#EDE9FE', // primary light
          200: '#DDD6FE',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED', // primary
          700: '#6D28D9', // hover
          800: '#5B21B6', // active
          900: '#4C1D95',
        },
        // Neutrals — slate
        ink: {
          50: '#F8FAFC', // app background
          100: '#F1F5F9', // surface secondary / border soft
          200: '#E2E8F0', // border
          300: '#CBD5E1',
          400: '#94A3B8', // text muted
          500: '#64748B', // text secondary
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A', // text primary
          950: '#020617',
        },
        // Legacy semantic aliases (used across components)
        signal: {
          amber: '#F59E0B', // warning
          rose: '#EF4444', // error
          blue: '#3B82F6', // info
        },
        // Explicit semantic + accent tokens
        success: { DEFAULT: '#10B981', light: '#D1FAE5' },
        warning: { DEFAULT: '#F59E0B', light: '#FEF3C7' },
        error: { DEFAULT: '#EF4444', light: '#FEE2E2' },
        info: { DEFAULT: '#3B82F6', light: '#DBEAFE' },
        pink: { DEFAULT: '#EC4899', light: '#FCE7F3' },
        cyan: { DEFAULT: '#06B6D4', light: '#CFFAFE' },
        orange: { DEFAULT: '#F97316', light: '#FFEDD5' },
      },
      fontFamily: {
        sans: ['Aptos', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
        mono: ['Cascadia Mono', 'SFMono-Regular', 'Consolas', 'Liberation Mono', 'monospace'],
      },
      boxShadow: {
        card: '0 4px 18px rgba(15, 23, 42, 0.06)',
        panel: '0 8px 24px rgba(15, 23, 42, 0.10)',
      },
      backgroundImage: {
        grid: 'linear-gradient(rgba(100,116,139,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(100,116,139,.08) 1px, transparent 1px)',
        'gradient-primary': 'linear-gradient(135deg, #7C3AED 0%, #A855F7 45%, #EC4899 100%)',
        'gradient-soft': 'linear-gradient(135deg, #EDE9FE 0%, #FCE7F3 55%, #DBEAFE 100%)',
        'gradient-ai': 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 50%, #3B82F6 100%)',
      },
    },
  },
  plugins: [],
};

export default config;
