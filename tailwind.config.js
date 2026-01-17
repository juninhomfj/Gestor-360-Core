/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
    "./utils/**/*.{js,ts,jsx,tsx}",
    "./config/**/*.{js,ts,jsx,tsx}",
    "./data/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#7C3AED",
          50: "#F5F3FF",
          100: "#EDE9FE",
          200: "#DDD6FE",
          300: "#C4B5FD",
          400: "#A78BFA",
          500: "#8B5CF6",
          600: "#7C3AED",
          700: "#6D28D9",
          800: "#5B21B6",
          900: "#4C1D95",
          950: "#2E1065",
        },
      },
      keyframes: {
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        swing: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '20%': { transform: 'rotate(15deg)' },
          '40%': { transform: 'rotate(-10deg)' },
          '60%': { transform: 'rotate(5deg)' },
          '80%': { transform: 'rotate(-5deg)' },
        },
        'plane-takeoff': {
          '0%': { transform: 'translate(-50px, 50px) scale(0.5)', opacity: '0' },
          '50%': { transform: 'translate(0, 0) scale(1.1)', opacity: '1' },
          '100%': { transform: 'translate(100px, -100px) scale(1.2)', opacity: '0' }
        },
        'success-pop': {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '70%': { transform: 'scale(1.2)' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        },
        'spin-slow': {
          'from': { transform: 'rotate(0deg)' },
          'to': { transform: 'rotate(360deg)' },
        }
      },
      animation: {
        shimmer: "shimmer 2s infinite",
        swing: 'swing 2s ease-in-out infinite',
        'plane-takeoff': 'plane-takeoff 2.5s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'success-pop': 'success-pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) 2s forwards',
        'spin-slow': 'spin-slow 3s linear infinite',
      },
    },
  },
  plugins: [],
};