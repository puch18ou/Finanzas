/**
 * vitest.config.ts — Configuracion del runner de tests.
 *
 * NODE environment: nuestras funciones de dominio son JS puro sin DOM.
 * No necesitamos jsdom (mas pesado). Si en el futuro testeamos componentes
 * React, anadiremos 'jsdom'.
 *
 * Alias @: replicamos el mismo que tsconfig.json para que los tests
 * puedan importar igual que el codigo de produccion.
 */
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
