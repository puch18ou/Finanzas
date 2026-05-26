/**
 * ============================================================================
 *  src/lib/repositories/base.ts — Tipos comunes a todos los repositorios
 * ============================================================================
 *
 *  Un "repository" es una capa de abstraccion que encapsula TODO el acceso a
 *  datos de una entidad (Settings, Categories, Expenses...). La UI nunca habla
 *  directamente con Drizzle: habla con un repositorio.
 *
 *  POR QUE ESTE PATRON
 *  -------------------
 *  1. La UI no sabe que la BD es SQLite local. En Fase C cambiaremos a SQLite
 *     local + sync con Turso, y los repositorios cambiaran por dentro, pero
 *     la firma publica seguira igual. La UI no se entera.
 *
 *  2. Concentramos en un sitio toda la logica de "como guardar X": generar
 *     UUID, calcular timestamps, manejar soft delete, validar invariantes
 *     pre-insert.
 *
 *  3. Testabilidad: podemos mockear repositorios facilmente.
 *
 *  ESTRUCTURA DE CADA REPOSITORIO
 *  ------------------------------
 *  Para cada entidad X creamos:
 *
 *    interface XRepository {
 *      list(filtro): Promise<X[]>
 *      getById(id): Promise<X | null>
 *      create(data): Promise<X>
 *      update(id, data): Promise<X>
 *      delete(id): Promise<void>
 *      // ... metodos especificos de la entidad
 *    }
 *
 *  Implementacion: clase que toma un cliente Drizzle por constructor y
 *  cumple esa interfaz.
 * ============================================================================
 */

import type { DrizzleDb } from "@/lib/db/proxy-driver";

/**
 * Base abstracta: solo guarda el cliente Drizzle. Las implementaciones
 * concretas la extienden y anaden metodos especificos de su entidad.
 *
 * No declaramos metodos comunes aqui porque cada entidad tiene matices
 * (settings es singleton, categorias tienen soft-delete, etc.). Cada
 * repository implementa los suyos.
 */
export abstract class BaseRepository {
  constructor(protected readonly db: DrizzleDb) {}
}

/**
 * Helper: timestamp actual en milisegundos. Se usa al crear/actualizar
 * filas para rellenar createdAt/updatedAt.
 *
 * En lugar de poner `Date.now()` repartido por el codigo, todos los repos
 * llaman a `now()`. Si en el futuro necesitamos congelar el tiempo en tests
 * o usar otra fuente, lo cambiamos en un solo sitio.
 */
export function now(): Date {
  return new Date();
}

/**
 * Helper: genera un UUID v4. Crypto API esta disponible en todos los
 * entornos modernos (browser + Node 16+).
 *
 * Los IDs deben generarse SIEMPRE en cliente, nunca autoincrementales,
 * por motivos de sync en Fase C (ver ARQUITECTURA seccion 4.3).
 */
export function newId(): string {
  return crypto.randomUUID();
}
