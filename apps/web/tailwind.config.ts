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
        background: 'var(--pds-background-layout-primary)',
        foreground: 'var(--pds-text-primary)',
        muted: 'var(--pds-muted)',
        card: 'var(--pds-background-card)',
        subtle: 'var(--pds-background-layout-secondary)',
        surface: {
          DEFAULT: 'var(--pds-background-layout-primary)',
          2: 'var(--pds-background-layout-secondary)',
          raised: 'var(--pds-background-card)',
        },
        border: {
          DEFAULT: 'var(--pds-border-color-primary)',
          focus: 'var(--pds-brand-dark)',
        },
        text: {
          DEFAULT: 'var(--pds-text-primary)',
          muted: 'var(--pds-muted)',
          subtle: 'var(--pds-muted)',
        },
        accent: 'var(--pds-brand-accent)',
        brand: {
          DEFAULT: 'var(--pds-compliment-brand)',
          dark: 'var(--pds-brand-dark)',
          ink: 'var(--pds-brand-ink)',
          light: 'var(--pds-compliment-brand)',
          muted: 'var(--pds-background-layout-secondary)',
          100: 'var(--pds-background-layout-secondary)',
          700: 'var(--pds-brand-accent)',
          900: 'var(--pds-primary)',
        },
        shell: {
          DEFAULT: 'var(--pds-shell)',
          raise: 'var(--pds-shell-raise)',
          line: 'var(--pds-shell-line)',
        },
        danger: { DEFAULT: 'var(--pds-color-red-danger)', bg: 'var(--pds-background-layout-secondary)' },
        success: { DEFAULT: 'var(--pds-brand-accent)', bg: 'var(--pds-background-layout-secondary)' },
        warning: { DEFAULT: 'var(--pds-color-yellow-500)', bg: 'var(--pds-background-layout-primary)' },
        tab: {
          inactive: 'var(--pds-foreground-contrast-medium)',
        },
        link: 'var(--pds-foreground-link)',
        subject: {
          blue: 'var(--pds-color-azure-60)',
          coral: 'var(--pds-color-accent-pomegrate)',
          teal: 'var(--pds-color-cyan-47)',
        },
        info: { DEFAULT: 'var(--pds-color-azure-60)', bg: 'var(--pds-background-layout-secondary)' },
      },
      fontFamily: {
        sans: ['var(--pds-font-family-body-stack)'],
        heading: ['var(--pds-font-family-display-stack)'],
      },
      spacing: {
        '0': 'var(--pds-gap-xx-small)',
        '0.5': 'var(--pds-gap-xx-small)',
        '1': 'var(--pds-gap-x-small)',
        '1.5': 'var(--pds-gap-x-small)',
        '2': 'var(--pds-gap-small)',
        '2.5': 'var(--pds-gap-x-small)',
        '3': 'var(--pds-gap-medium)',
        '3.25': 'var(--pds-gap-medium)',
        '3.5': 'var(--pds-gap-medium)',
        '4': 'var(--pds-gap-large)',
        '5': 'var(--pds-padding-large)',
        '6': 'var(--pds-gap-x-large)',
        '6.5': 'var(--pds-size-large)',
        '7': 'var(--pds-padding-xx-large)',
        '8': 'var(--pds-padding-xx-large)',
        '9': 'var(--pds-size-xxx-large)',
        '10': 'var(--pds-padding-xx-large)',
      },
      maxWidth: {
        content: 'var(--pds-width-1180)',
      },
      width: {
        sidebar: 'var(--pds-size-jumbo)',
      },
      gap: {
        section: 'var(--pds-gap-large)',
        page: 'var(--pds-gap-large)',
        panel: 'var(--pds-gap-medium)',
        'panel-body': 'var(--pds-gap-large)',
        'record-list': 'var(--pds-gap-x-small)',
      },
      padding: {
        panel: 'var(--pds-padding-large)',
        frame: 'var(--pds-padding-large)',
        'record-list-item': 'var(--pds-padding-small)',
      },
      borderRadius: {
        sm: 'var(--pds-radius-12)',
        DEFAULT: 'var(--pds-radius-base)',
        md: 'var(--pds-radius-14)',
        lg: 'var(--pds-radius-24)',
        pill: 'var(--pds-radius-pill)',
      },
      screens: {
        sm: 'var(--pds-breakpoint-sm)',
        md: 'var(--pds-breakpoint-md)',
        lg: 'var(--pds-breakpoint-lg)',
      },
    },
  },
  plugins: [],
}

export default config
