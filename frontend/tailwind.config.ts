import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Noto Sans JP', 'sans-serif'],
      },
      colors: {
        primary: {
          50:  '#E8EFF7',
          100: '#D5E2F1',
          500: '#6B8EC7',
          600: '#45669B',
          700: '#38537F',
        },
        ink: {
          400: '#A39C8B',
          500: '#837D6F',
          600: '#5E5A51',
          700: '#4E4B44',
          800: '#3A3833',
          900: '#2B2A26',
        },
        surface: {
          app:    '#F6F1E7',
          subtle: '#F1EADC',
          hover:  '#EEE6D7',
        },
        border: {
          DEFAULT: '#E5DDCE',
          strong:  '#D2C7B2',
          divider: '#EBE3D4',
        },
        success: {
          DEFAULT: '#3F8C5C',
          bg:      '#E6F1E7',
        },
        warning: {
          DEFAULT: '#C28A1E',
          bg:      '#FBF0D5',
        },
        danger: {
          DEFAULT: '#CF4A41',
          bg:      '#FBE7E3',
        },
        score: {
          low:  '#CF4A41',
          mid:  '#C28A1E',
          high: '#3F8C5C',
        },
      },
      fontSize: {
        caption: ['12px', { lineHeight: '1.5' }],
        label:   ['12px', { lineHeight: '1.4', fontWeight: '600' }],
        body:    ['14px', { lineHeight: '1.7' }],
        h3:      ['15px', { lineHeight: '1.4' }],
        h2:      ['18px', { lineHeight: '1.4' }],
        h1:      ['24px', { lineHeight: '1.35' }],
      },
      borderRadius: {
        sm:      '4px',
        DEFAULT: '6px',
        lg:      '8px',
      },
      boxShadow: {
        xs:    '0 1px 2px rgba(20,24,33,.05)',
        sm:    '0 1px 3px rgba(20,24,33,.08)',
        focus: '0 0 0 3px rgba(69,102,155,.22)',
      },
    },
  },
  plugins: [],
};

export default config;
