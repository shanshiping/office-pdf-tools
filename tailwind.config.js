/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: '#EE6C4D',
          green: '#8FBC5D',
          red: '#E74C3C',
          blue: '#3498DB',
        }
      }
    },
  },
  plugins: [],
}
