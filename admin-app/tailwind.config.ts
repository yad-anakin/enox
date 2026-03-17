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
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
