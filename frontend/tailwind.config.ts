import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f5ff',
          100: '#dde8ff',
          200: '#c0d4ff',
          300: '#95b6ff',
          400: '#6492ff',
          500: '#2b70ef',
          600: '#2250df',
          700: '#1a40b5',
          800: '#13318d',
          900: '#0e266a',
          950: '#07194e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
