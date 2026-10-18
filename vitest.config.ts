import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Pruebas de la lógica pura (reglas del negocio, cálculos, mensajes): no necesitan navegador.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
