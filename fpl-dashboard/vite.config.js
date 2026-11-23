import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sectionPages } from './scripts/section-pages.mjs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), sectionPages()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
})
