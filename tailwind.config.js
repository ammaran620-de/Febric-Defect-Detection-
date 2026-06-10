/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        // Minimalist industrial palette
        surface: {
          DEFAULT: '#F8FAFC',
          dark: '#0F1117',
        },
        card: {
          DEFAULT: '#FFFFFF',
          dark: '#161B22',
        },
        border: {
          DEFAULT: '#E2E8F0',
          dark: '#21262D',
          accent: '#D4AF37', // gold accent border
        },
        ink: {
          primary: '#0F172A',
          secondary: '#64748B',
          muted: '#94A3B8',
          dark: '#E2E8F0',
        },
        accent: {
          blue: '#2563EB',
          green: '#16A34A',
          red: '#DC2626',
          amber: '#D97706',
          indigo: '#4F46E5',
        },
        // Minimalist grays
        slate: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
        }
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0,0,0,0.07), 0 1px 2px -1px rgba(0,0,0,0.07)',
        'card-md': '0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.07)',
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'sticker-pop': 'stickerPop 0.2s ease-out',
      },
      keyframes: {
        'pulse-ring': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 0 0 rgba(220,38,38,0.7)' },
          '50%': { opacity: '0.8', boxShadow: '0 0 0 8px rgba(220,38,38,0)' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        stickerPop: {
          from: { transform: 'scale(0.5)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
