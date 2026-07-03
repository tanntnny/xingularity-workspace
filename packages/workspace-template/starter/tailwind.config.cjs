/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/index.html',
    './src/**/*.{ts,tsx}',
    '../src/**/*.{ts,tsx}',
    './node_modules/@xingularity/workspace-template/src/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {}
  },
  plugins: []
}
