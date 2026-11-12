/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        alert: {
          50: '#fff1f1',
          100: '#ffe0e0',
          500: '#d13c3c',
          600: '#b52f2f',
          700: '#8f2424'
        }
      }
    }
  },
  plugins: []
};
