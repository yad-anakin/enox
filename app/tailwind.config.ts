import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#000000',
        foreground: '#ffffff',
        card: { DEFAULT: '#0f0f0f', foreground: '#ffffff' },
        popover: { DEFAULT: '#0f0f0f', foreground: '#ffffff' },
        primary: { DEFAULT: '#ffffff', foreground: '#000000' },
        secondary: { DEFAULT: '#1a1a1a', foreground: '#a1a1a1' },
        muted: { DEFAULT: '#121212', foreground: '#a1a1a1' },
        accent: { DEFAULT: '#1a1a1a', foreground: '#ffffff' },
        destructive: { DEFAULT: '#ef4444', foreground: '#ffffff' },
        border: 'rgba(255,255,255,0.08)',
        input: 'rgba(255,255,255,0.08)',
        ring: 'rgba(255,255,255,0.2)',
      },
      borderRadius: {
        lg: '0.75rem',
        md: '0.5rem',
        sm: '0.375rem',
        xl: '1rem',
        '2xl': '1.25rem',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'slide-in': { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(0)' } },
        shimmer: { '0%': { backgroundPosition: '200% 0' }, '100%': { backgroundPosition: '-200% 0' } },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'fade-up': 'fade-up 0.4s ease-out',
        'slide-in': 'slide-in 0.3s ease-out',
        shimmer: 'shimmer 2s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
