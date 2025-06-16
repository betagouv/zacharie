import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/{**,.client,.server}/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      screens: {
        xs: '450px',
      },
      borderColor: {
        DEFAULT: '#000',
      },
      borderWidth: {
        6: '6px',
        3: '3px',
      },
      colors: {
        'action-high-blue-france': {
          DEFAULT: 'var(--text-action-high-blue-france)',
          dark: '#8585f6',
          light: '#000091',
        },
        'alt-blue-france': {
          DEFAULT: 'var(--background-alt-blue-france)',
          dark: '#1b1b35',
          light: '#f5f5fe',
        },
        'error-main-525': {
          DEFAULT: '#f60700',
          dark: '#f60700',
          light: '#f60700',
        },
        'warning-main-525': {
          DEFAULT: '#d64d00',
          dark: '#d64d00',
          light: '#d64d00',
        },
        'error-850': {
          DEFAULT: '#ffbdbd',
          dark: '#ffbdbd',
          light: '#ffbdbd',
        },
        'success-main-525': {
          DEFAULT: '#1f8d49',
          dark: '#1f8d49',
          light: '#1f8d49',
        },
        'success-main-625': {
          DEFAULT: '#27A658',
          dark: '#27A658',
          light: '#27A658',
        },
        'green-emeraude': {
          DEFAULT: 'var(--green-emeraude-main-632)',
        },
        'contrast-grey': {
          DEFAULT: 'var(--background-contrast-grey)',
        },
        'disabled-grey': {
          DEFAULT: 'var(--text-disabled-grey)',
        },
        'active-tint': 'var(--active-tint)',
      },
    },
  },
  plugins: [],
} satisfies Config;
