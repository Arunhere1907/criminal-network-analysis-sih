import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  base: './',
  css: {
    postcss: {} // Prevent Vite from traversing up to parent directories for postcss.config.js
  },
  server: {
    port: 5173,
    host: '127.0.0.1'
  }
})
