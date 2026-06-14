/**
 * ============================================================================
 *  src/lib/repositories/patrimonio-snapshot-repository.ts
 * ============================================================================
 *
 *  Historico del patrimonio (una foto al dia). Ver schema.ts
 *  (patrimonioSnapshots) y domain/networth.ts (computeNetWorth).
 *
 *  El id es DETERMINISTA por dia ("snap-YYYY-MM-DD"): `upsertForDay` inserta
 *  la foto del dia o, si ya existe, la ACTUALIZA (la ultima del dia gana). Asi
 *  abrir la app varias veces el mismo dia no duplica filas.
 * ============================================================================
 */

import { isNull, asc } from "drizzle-orm";
import {
  patrimonioSnapshots,
  type PatrimonioSnapshot,
  type NewPatrimonioSnapshot,
} from "@/lib/db/schema";
import { BaseRepository, now } from "./base";

/** Clave de dia (UTC) de una fecha civil: "YYYY-MM-DD". */
function dayKey(fecha: Date): string {
  const y = fecha.getUTCFullYear();
  const m = String(fecha.getUTCMonth() + 1).padStart(2, "0");
  const d = String(fecha.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type SnapshotData = {
  /** Fecha civil del dia (mediodia UTC). */
  fecha: Date;
  moneda: string;
  valorCuentas: number;
  valorInversiones: number;
  deudaTotal: number;
  patrimonioNeto: number;
};

export class PatrimonioSnapshotRepository extends BaseRepository {
  /**
   * Inserta o actualiza la foto del dia de `data.fecha`. Idempotente por dia:
   * vuelve a abrir la app -> la foto del dia se refresca con el ultimo valor.
   */
  async upsertForDay(data: SnapshotData): Promise<void> {
    const ts = now();
    const id = `snap-${dayKey(data.fecha)}`;
    const row: NewPatrimonioSnapshot = {
      id,
      fecha: data.fecha,
      moneda: data.moneda,
      valorCuentas: data.valorCuentas,
      valorInversiones: data.valorInversiones,
      deudaTotal: data.deudaTotal,
      patrimonioNeto: data.patrimonioNeto,
      createdAt: ts,
      updatedAt: ts,
      deletedAt: null,
    };
    await this.db
      .insert(patrimonioSnapshots)
      .values(row)
      .onConflictDoUpdate({
        target: patrimonioSnapshots.id,
        set: {
          fecha: row.fecha,
          moneda: row.moneda,
          valorCuentas: row.valorCuentas,
          valorInversiones: row.valorInversiones,
          deudaTotal: row.deudaTotal,
          patrimonioNeto: row.patrimonioNeto,
          updatedAt: ts,
          deletedAt: null,
        },
      });
  }

  /** Todas las fotos vivas, ordenadas por fecha ascendente. */
  async list(): Promise<PatrimonioSnapshot[]> {
    return this.db
      .select()
      .from(patrimonioSnapshots)
      .where(isNull(patrimonioSnapshots.deletedAt))
      .orderBy(asc(patrimonioSnapshots.fecha));
  }
}
