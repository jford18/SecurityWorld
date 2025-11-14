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
      '/consolas': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/menus': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
