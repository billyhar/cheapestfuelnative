/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#F73535',
          dark: '#F73535',
        },
        secondary: {
          DEFAULT: '#5856D6',
          dark: '#5E5CE6',
        },
        success: {
          DEFAULT: '#34C759',
          dark: '#32D74B',
        },
        warning: {
          DEFAULT: '#FF9500',
          dark: '#FFD60A',
        },
        error: {
          DEFAULT: '#FF3B30',
          dark: '#FF453A',
        },
        brand: {
          DEFAULT: '#F73535',
          dark: '#F73535',
        },
        background: {
          DEFAULT: '#FFFFFF',
          dark: '#000000',
        },
        surface: {
          DEFAULT: '#F2F2F7',
          dark: '#1C1C1E',
        },
        text: {
          DEFAULT: '#000000',
          dark: '#FFFFFF',
        },
        textSecondary: {
          DEFAULT: '#6C6C70',
          dark: '#98989F',
        },
      },
    },
  },
  plugins: [],
}
