/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/src/**/*.{js,jsx,ts,tsx}', './src/renderer/index.html'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f5f3ff',
          100: '#ede9fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          900: '#3b0764'
        }
      }
    }
  },
  plugins: []
}
