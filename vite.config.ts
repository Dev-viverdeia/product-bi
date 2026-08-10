import path from 'node:path'
// defineConfig vem de vitest/config (reexporta o do Vite) para o bloco `test`
// ser tipado — com o de 'vite' puro, `test` não existe no tipo.
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
  test: {
    // Os testes cobrem lógica pura (contratos de métrica e formatação), então
    // rodam em Node — sem jsdom, que só entraria com teste de componente.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
