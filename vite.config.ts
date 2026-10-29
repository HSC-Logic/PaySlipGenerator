import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  // amazon-cognito-identity-js reads Node's `global`, which browsers do not define.
  return { plugins: [react()], base: env.VITE_BASE_PATH || '/', define: { global: 'globalThis' } }
})
