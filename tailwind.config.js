/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Backgrounds
        'bg-app': '#10131A',
        'bg-card': '#171C24',
        'bg-sidebar': '#0B0F16',
        'bg-deep': '#111722',

        // Marque Nikito
        nikito: {
          pink: '#F25F9B',
          violet: '#9A82F0',
          cyan: '#45D7F5',
        },

        // Sémantique KPI
        lime: '#BFEA4D',
        amber: '#F6B44B',
        red: '#F05D6E',
        green: '#54C99B',

        // Texte
        text: '#F7F8FB',
        dim: '#A7B0C2',
        faint: '#687386',
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
        xl: '8px',
        '2xl': '10px',
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
