import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  base: '/map/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    chunkSizeWarningLimit: 2500, // Increase warning limit for large geojson files
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('echarts') || id.includes('zrender')) {
              return 'echarts-vendor';
            }
            if (id.includes('vue') || id.includes('@vue') || id.includes('pinia') || id.includes('vue-router')) {
              return 'vue-vendor';
            }
            return 'vendor';
          }
          if (id.includes('src/assets/geojson/')) {
            // Put each geojson file into its own chunk
            const match = id.match(/([^/]+)\.json$/);
            if (match) {
              return match[1];
            }
          }
        }
      }
    }
  }
})
