/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    extend: {
      colors: {
        'king-gold': '#D4AF37',
        'king-dark': '#1A1A1A',
        'king-beige': '#F5F1E8',
        'king-amber': {
          50: '#FFFBF0',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
        },
        background: '#ffffff',
        foreground: '#111827',
        primary: '#B45309',
        'primary-foreground': '#ffffff',
        input: '#64748B',
        ring: '#B45309',
        muted: '#F3F4F6',
        'muted-foreground': '#4B5563',
        secondary: '#E5E7EB',
        'secondary-foreground': '#1F2937',
        accent: '#FEF3C7',
        'accent-foreground': '#78350F',
        destructive: '#B91C1C',
        'destructive-foreground': '#ffffff',
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'bounce-subtle': 'bounceSubtle 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
      },
      boxShadow: {
        'king': '0 4px 20px rgba(212, 175, 55, 0.15)',
        'king-lg': '0 10px 40px rgba(212, 175, 55, 0.25)',
      },
    },
  },
  plugins: [],
}
