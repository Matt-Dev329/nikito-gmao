/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Backgrounds
        'bg-app': '#0B0B2E',
        'bg-card': '#151547',
        'bg-sidebar': '#07071F',
        'bg-deep': '#0D0D38',

        // Marque Nikito
        nikito: {
          pink: '#E85A9B',
          violet: '#9B7EE8',
          cyan: '#5DE5FF',
        },

        // Sémantique KPI
        lime: '#D4F542',
        amber: '#FFB547',
        red: '#FF4D6D',
        green: '#4DD09E',

        // Texte
        text: '#FFFFFF',
        dim: '#A8A8C8',
        faint: '#6E6E96',
      },
      fontFamily: {
        sans: ['-apple-system', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['SF Mono', 'Monaco', 'Consolas', 'monospace'],
      },
      backgroundImage: {
        'gradient-logo': 'linear-gradient(90deg, #E85A9B, #9B7EE8, #5DE5FF)',
        'gradient-action': 'linear-gradient(90deg, #4DD09E, #5DE5FF)',
        'gradient-cta': 'linear-gradient(90deg, #E85A9B, #9B7EE8, #5DE5FF)',
        'gradient-danger': 'linear-gradient(135deg, #FF4D6D, #E85A9B)',
        'gradient-active': 'linear-gradient(90deg, rgba(232,90,155,.18), rgba(155,126,232,.10))',
      },
      borderRadius: {
        pill: '20px',
      },
      keyframes: {
        'pulse-subtle': {
          '0%, 100%': { borderColor: 'rgba(93,229,255,1)' },
          '50%': { borderColor: 'rgba(93,229,255,0.4)' },
        },
      },
      animation: {
        'pulse-subtle': 'pulse-subtle 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
