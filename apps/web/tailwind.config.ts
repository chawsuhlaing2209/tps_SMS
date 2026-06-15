import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#254f1a',
          light: '#d2e823',
          muted: '#e8f5e9',
        },
        surface: {
          DEFAULT: '#fafafa',
          2: '#f4f4f5',
          raised: '#ffffff',
        },
        border: {
          DEFAULT: '#e4e4e7',
          focus: '#254f1a',
        },
        text: {
          DEFAULT: '#18181b',
          muted: '#71717a',
          subtle: '#a1a1aa',
        },
        danger: { DEFAULT: '#dc2626', bg: '#fef2f2' },
        success: { DEFAULT: '#16a34a', bg: '#f0fdf4' },
        warning: { DEFAULT: '#d97706', bg: '#fffbeb' },
        info: { DEFAULT: '#2563eb', bg: '#eff6ff' },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Padauk', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px' }],
        xs: ['11px', { lineHeight: '16px' }],
        sm: ['12px', { lineHeight: '16px' }],
        base: ['13px', { lineHeight: '20px' }],
        md: ['14px', { lineHeight: '20px' }],
        lg: ['16px', { lineHeight: '24px' }],
        xl: ['18px', { lineHeight: '28px' }],
        '2xl': ['20px', { lineHeight: '28px' }],
        '3xl': ['24px', { lineHeight: '32px' }],
        '4xl': ['28px', { lineHeight: '36px' }],
      },
      borderRadius: {
        sm: '2px',
        DEFAULT: '4px',
        md: '6px',
        lg: '8px',
        xl: '12px',
      },
      boxShadow: {
        xs: '0 1px 2px rgba(0,0,0,.06)',
        sm: '0 1px 3px rgba(0,0,0,.10)',
        md: '0 4px 12px rgba(0,0,0,.12)',
        lg: '0 8px 24px rgba(0,0,0,.14)',
      },
    },
  },
  plugins: [],
}

export default config
