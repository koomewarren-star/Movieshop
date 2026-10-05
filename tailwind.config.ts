import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: '#000000',
        ink: '#09090b',
        charcoal: {
          DEFAULT: '#18181b',
          soft: '#27272a',
        },
        crimson: {
          DEFAULT: '#DC2626',
          bright: '#EF4444',
          deep: '#991B1B',
        },
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(239,68,68,0.35), 0 0 24px -4px rgba(220,38,38,0.55), 0 0 60px -12px rgba(220,38,38,0.4)',
        'glow-lg': '0 0 0 1px rgba(239,68,68,0.45), 0 0 40px -6px rgba(239,68,68,0.7), 0 0 100px -20px rgba(220,38,38,0.55)',
        panel: '0 24px 60px -24px rgba(0,0,0,0.95)',
      },
      backgroundImage: {
        'crimson-sheen': 'linear-gradient(120deg, #991B1B 0%, #DC2626 45%, #EF4444 100%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.85)', opacity: '0.6' },
          '70%': { transform: 'scale(1.3)', opacity: '0' },
          '100%': { transform: 'scale(1.3)', opacity: '0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.55s cubic-bezier(0.22,1,0.36,1) both',
        'scale-in': 'scale-in 0.28s cubic-bezier(0.22,1,0.36,1) both',
        shimmer: 'shimmer 2s infinite',
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.24,0,0.38,1) infinite',
        float: 'float 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
