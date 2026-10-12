import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// React and Firebase change far less often than application code, so they are
// split into their own long-lived chunks. This keeps them cached across app
// rebuilds instead of being re-downloaded with the main bundle every time.
const VENDOR_CHUNKS = [
  ['vendor-firebase', /[\\/]node_modules[\\/](?:@firebase|firebase)[\\/]/],
  ['vendor-react', /[\\/]node_modules[\\/](?:react|react-dom|react-router|react-router-dom|scheduler)[\\/]/],
]

function manualChunks(id) {
  const match = VENDOR_CHUNKS.find(([, test]) => test.test(id))
  return match ? match[0] : undefined
}

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
