import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      axios: path.resolve(__dirname, 'axios/index.js'),
    },
  },
  server: {
    proxy: {
      // FIX: El proxy reenvía las llamadas /api al backend en el puerto 3000 para evitar el 404 del servidor de desarrollo en 5173.
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
