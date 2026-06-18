import type { Config } from 'tailwindcss'

/** Mirrors Padauk spatial + color tokens from `app/globals.css` `:root`. */
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        muted: 'var(--muted)',
        card: 'var(--card)',
        subtle: 'var(--subtle)',
        surface: {
          DEFAULT: 'var(--surface)',
          2: 'var(--subtle)',
          raised: 'var(--card)',
        },
        border: {
          DEFAULT: 'var(--border)',
          focus: 'var(--brand-dark)',
        },
        text: {
          DEFAULT: 'var(--foreground)',
          muted: 'var(--muted)',
          subtle: 'var(--muted)',
        },
        accent: 'var(--accent)',
        brand: {
          DEFAULT: 'var(--brand)',
          dark: 'var(--brand-dark)',
          ink: 'var(--brand-ink)',
          light: 'var(--brand)',
          muted: 'var(--subtle)',
          100: 'var(--brand-100)',
          700: 'var(--brand-700)',
          900: 'var(--brand-900)',
        },
        shell: {
          DEFAULT: 'var(--shell)',
          raise: 'var(--shell-raise)',
          line: 'var(--shell-line)',
        },
        danger: { DEFAULT: 'var(--danger)', bg: 'var(--color-grey-93)' },
        success: { DEFAULT: 'var(--accent)', bg: 'var(--color-grey-93)' },
        warning: { DEFAULT: 'var(--color-cat-mustard)', bg: 'var(--color-grey-96)' },
        tab: {
          inactive: 'var(--tab-inactive-fg)',
        },
        link: 'var(--link)',
        subject: {
          blue: 'var(--subject-blue)',
          coral: 'var(--subject-coral)',
          teal: 'var(--subject-teal)',
        },
        info: { DEFAULT: 'var(--info)', bg: 'var(--color-grey-93)' },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        heading: ['var(--font-heading)'],
      },
      spacing: {
        '0': 'var(--space-0)',
        '0.5': 'var(--space-0_5)',
        '1': 'var(--space-1)',
        '1.5': 'var(--space-1_5)',
        '2': 'var(--space-2)',
        '2.5': 'var(--space-2_5)',
        '3': 'var(--space-3)',
        '3.25': 'var(--space-3_25)',
        '3.5': 'var(--space-3_5)',
        '4': 'var(--space-4)',
        '5': 'var(--space-5)',
        '6': 'var(--space-6)',
        '6.5': 'var(--space-6_5)',
        '7': 'var(--space-7)',
        '8': 'var(--space-8)',
        '9': 'var(--space-9)',
        '10': 'var(--space-10)',
      },
      maxWidth: {
        content: 'var(--layout-content-max)',
      },
      width: {
        sidebar: 'var(--layout-sidebar-width)',
      },
      gap: {
        section: 'var(--layout-section-gap)',
        page: 'var(--layout-page-gap)',
        panel: 'var(--frame-header-body-gap)',
        'panel-body': 'var(--frame-body-gap)',
        'record-list': 'var(--record-list-gap)',
      },
      padding: {
        panel: 'var(--frame-padding)',
        frame: 'var(--frame-padding)',
        'record-list-item': 'var(--record-list-item-padding)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius-base)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        pill: 'var(--radius-pill)',
      },
      screens: {
        sm: '640px',
        md: '720px',
        lg: '960px',
      },
    },
  },
  plugins: [],
}

export default config
