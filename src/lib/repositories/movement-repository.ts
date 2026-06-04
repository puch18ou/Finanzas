/**
 * ============================================================================
 *  src/lib/repositories/movement-repository.ts
 * ============================================================================
 *
 *  CRUD para la tabla `movements`. Es el repositorio mas importante de la
 *  Fase 2: practicamente todas las operaciones financieras pasan por aqui.
 *
 *  Filtros tipicos:
 *    - por periodo (anio+mes)
 *    - por tipo (gasto/ingreso/transferencia/ajuste...)
 *    - por cuenta (origen o destino)
 *    - por categoria
 *
 *  Las queries pesadas (calcular saldo de una cuenta) tambien viven aqui,
 *  para que el repositorio mantenga la responsabilidad sobre su tabla.
 *
 *  En el lote 10a aun NO calculamos saldos automaticamente. Eso es 10b.
 *  Solo aportamos las queries de lectura agregada para que esten listas.
 * ============================================================================
 */

import { and, desc, eq, gte, lte, isNull, isNotNull, sql, or, inArray } from "drizzle-orm";
import {
  movements,
  type Movement,
  type NewMovement,
} from "@/lib/db/schema";
import { BaseRepository, newId, now } from "./base";

export type MovementType =
  | "gasto"
  | "ingreso"
  | "transferencia"
  | "ajuste"
  | "intereses"
  | "cuota";

export type CreateMovementData = Omit<
  NewMovement,
  "id" | "createdAt" | "updatedAt" | "deletedAt"
>;
export type UpdateMovementData = Partial<CreateMovementData>;

export type MovementFilter = {
  anio?: number;
  mes?: number;
  anioDesde?: number;  // rango inclusivo de anios (para vistas multi-anio)
  anioHasta?: number;
  tipo?: MovementType | MovementType[];
  cuentaId?: string;       // matchea origen O destino
  categoriaId?: string;
  esAutomatico?: boolean;
};

export class MovementRepository extends BaseRepository {
  /**
   * Lista de movimientos activos, ordenados por fecha desc.
   * Filtros combinables.
   */
  async list(filter: MovementFilter = {}): Promise<Movement[]> {
    const conditions = [isNull(movements.deletedAt)];

    if (filter.anio != null) conditions.push(eq(movements.anio, filter.anio));
    if (filter.mes != null) conditions.push(eq(movements.mes, filter.mes));
    if (filter.anioDesde != null)
      conditions.push(gte(movements.anio, filter.anioDesde));
    if (filter.anioHasta != null)
      conditions.push(lte(movements.anio, filter.anioHasta));

    if (filter.tipo != null) {
      if (Array.isArray(filter.tipo)) {
        // Drizzle no tiene IN tipado limpio en este contexto;
        // construimos OR de eq
        const tipoConds = filter.tipo.map((t) => eq(movements.tipo, t));
        if (tipoConds.length === 1) {
          conditions.push(tipoConds[0]!);
        } else if (tipoConds.length > 1) {
          // or() requiere al menos dos args
          const orExpr = or(...tipoConds);
          if (orExpr) conditions.push(orExpr);
        }
      } else {
        conditions.push(eq(movements.tipo, filter.tipo));
      }
    }

    if (filter.cuentaId != null) {
      const orExpr = or(
        eq(movements.cuentaOrigenId, filter.cuentaId),
        eq(movements.cuentaDestinoId, filter.cuentaId),
      );
      if (orExpr) conditions.push(orExpr);
    }

    if (filter.categoriaId != null) {
      conditions.push(eq(movements.categoriaId, filter.categoriaId));
    }

    if (filter.esAutomatico != null) {
      conditions.push(eq(movements.esAutomatico, filter.esAutomatico));
    }

    return this.db
      .select()
      .from(movements)
      .where(and(...conditions))
      .orderBy(desc(movements.fecha), desc(movements.createdAt));
  }

  /**
   * Lista los soft-deleted (papelera).
   */
  async listDeleted(): Promise<Movement[]> {
    return this.db
      .select()
      .from(movements)
      .where(isNotNull(movements.deletedAt))
      .orderBy(desc(movements.deletedAt));
  }

  async getById(id: string): Promise<Movement | null> {
    const rows = await this.db
      .select()
      .from(movements)
      .where(eq(movements.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async create(data: CreateMovementData): Promise<Movement> {
    const ts = now();
    const id = newId();

    // Denormalizamos mes/anio si no vienen ya (el caller deberia mandarlos,
    // pero por defensa los recalculamos desde fecha).
    const fecha = data.fecha instanceof Date ? data.fecha : new Date(data.fecha);
    const mes = data.mes ?? fecha.getMonth() + 1;
    const anio = data.anio ?? fecha.getFullYear();

    await this.db.insert(movements).values({
      ...data,
      id,
      mes,
      anio,
      createdAt: ts,
      updatedAt: ts,
      deletedAt: null,
    });

    const created = await this.getById(id);
    if (!created) throw new Error("MovementRepository.create: post-insert read failed");
    return created;
  }

  async update(id: string, patch: UpdateMovementData): Promise<Movement> {
    // Si la fecha cambia, recalculamos mes/anio
    const updates: Partial<NewMovement> = { ...patch, updatedAt: now() };
    if (patch.fecha) {
      const fecha = patch.fecha instanceof Date ? patch.fecha : new Date(patch.fecha);
      updates.mes = fecha.getMonth() + 1;
      updates.anio = fecha.getFullYear();
    }

    await this.db.update(movements).set(updates).where(eq(movements.id, id));

    const updated = await this.getById(id);
    if (!updated) throw new Error(`MovementRepository.update: id ${id} no existe`);
    return updated;
  }

  async softDelete(id: string): Promise<void> {
    const ts = now();
    await this.db
      .update(movements)
      .set({ deletedAt: ts, updatedAt: ts })
      .where(eq(movements.id, id));
  }

  async restore(id: string): Promise<void> {
    await this.db
      .update(movements)
      .set({ deletedAt: null, updatedAt: now() })
      .where(eq(movements.id, id));
  }

  // ---------------------------------------------------------------------
  // Queries agregadas (las necesitaremos en 10b)
  // ---------------------------------------------------------------------

  /**
   * Suma del impacto NETO de movimientos sobre una cuenta dada.
   *
   * Para una cuenta C:
   *   - cuando C es origen   → resta importe
   *   - cuando C es destino  → suma importe
   *   - ajustes con C como origen y signo negativo → suma |importe|
   *     (NOTA: para Lote 10a no usamos ajustes con signo, se modelaran
   *      siempre como pareja origen/destino con importe positivo. Si en
   *      el futuro necesitamos ajustes con signo, este metodo tendra que
   *      tratarlos explicitamente).
   *
   * Esto sera la base del saldo calculado en 10b.
   */
  /**
   * Lote 10b-3: asigna `accountId` a los movimientos que NO tienen cuenta,
   * segun su tipo:
   *   - gasto/cuota   → cuentaOrigenId (si esta NULL)
   *   - ingreso/intereses → cuentaDestinoId (si esta NULL)
   * Transferencias y ajustes se omiten (requieren cuentas explicitas).
   *
   * Idempotente: solo toca filas con la cuenta correspondiente a NULL, asi
   * que volver a ejecutarlo no reasigna nada. Devuelve cuantas filas se
   * modificaron.
   */
  async backfillMissingAccount(accountId: string): Promise<number> {
    const origenCond = and(
      isNull(movements.deletedAt),
      isNull(movements.cuentaOrigenId),
      inArray(movements.tipo, ["gasto", "cuota"]),
    );
    const destinoCond = and(
      isNull(movements.deletedAt),
      isNull(movements.cuentaDestinoId),
      inArray(movements.tipo, ["ingreso", "intereses"]),
    );

    const origenOrphans = await this.db
      .select({ id: movements.id })
      .from(movements)
      .where(origenCond);
    const destinoOrphans = await this.db
      .select({ id: movements.id })
      .from(movements)
      .where(destinoCond);

    const ts = now();
    if (origenOrphans.length > 0) {
      await this.db
        .update(movements)
        .set({ cuentaOrigenId: accountId, updatedAt: ts })
        .where(origenCond);
    }
    if (destinoOrphans.length > 0) {
      await this.db
        .update(movements)
        .set({ cuentaDestinoId: accountId, updatedAt: ts })
        .where(destinoCond);
    }

    return origenOrphans.length + destinoOrphans.length;
  }

  async impactoNetoCuenta(cuentaId: string): Promise<number> {
    const result = await this.db
      .select({
        suma: sql<number>`
          COALESCE(
            SUM(
              CASE
                WHEN ${movements.cuentaDestinoId} = ${cuentaId} THEN ${movements.importe}
                WHEN ${movements.cuentaOrigenId} = ${cuentaId} THEN -${movements.importe}
                ELSE 0
              END
            ),
            0
          )
        `,
      })
      .from(movements)
      .where(
        and(
          isNull(movements.deletedAt),
          or(
            eq(movements.cuentaOrigenId, cuentaId),
            eq(movements.cuentaDestinoId, cuentaId),
          ),
        ),
      );
    return Number(result[0]?.suma ?? 0);
  }
}
