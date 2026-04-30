import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#f2f0eb',
        ink: '#1d1d1d',
        accent: {
          DEFAULT: '#006241',
          dim: '#1a8a5a',
          bright: '#3aa97a',
        },
        warn: '#c8541b',
        danger: '#a31518',
      },
      fontFamily: {
        sans: ['"SoDoSans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
