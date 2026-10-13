import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#0f1116',
        card: '#1a1d25',
        'card-hover': '#22262f',
        accent: '#00e676',
        'accent-red': '#ff1744',
        'surface': '#13151b',
        'text-muted': '#8b8fa3',
      },
      animation: {
        'pulse-live': 'pulse-live 1.5s ease-in-out infinite',
      },
      keyframes: {
        'pulse-live': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
