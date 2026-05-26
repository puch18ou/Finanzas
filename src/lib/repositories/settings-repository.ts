/**
 * ============================================================================
 *  src/lib/repositories/settings-repository.ts
 * ============================================================================
 *
 *  Acceso a la fila singleton de `settings`. Esta tabla es especial: solo
 *  puede haber una fila con id='singleton', enforced por el CHECK constraint.
 *
 *  Operaciones:
 *    - get():     devuelve la fila actual (siempre existe tras runSeed())
 *    - update():  actualiza campos parciales. Tambien refresca updatedAt.
 *
 *  No hay create/delete: la fila la crea el seed y nunca se borra.
 * ============================================================================
 */

import { eq } from "drizzle-orm";
import { settings, type Settings } from "@/lib/db/schema";
import { BaseRepository, now } from "./base";

/**
 * Tipo de los campos que se pueden actualizar. Excluimos los campos
 * que no deben ser editables desde la UI (id, createdAt, updatedAt).
 * `updatedAt` lo manejara el repo internamente.
 */
export type SettingsPatch = Partial<
  Omit<Settings, "id" | "createdAt" | "updatedAt">
>;

export interface ISettingsRepository {
  /**
   * Devuelve la fila singleton. Si por algun motivo no existe (raro;
   * el seed la crea siempre), devuelve null y la UI debe mostrar error.
   */
  get(): Promise<Settings | null>;

  /**
   * Actualiza uno o varios campos. Devuelve la fila resultante.
   * Lanza si la fila singleton no existe.
   */
  update(patch: SettingsPatch): Promise<Settings>;
}

export class SettingsRepository
  extends BaseRepository
  implements ISettingsRepository
{
  async get(): Promise<Settings | null> {
    const rows = await this.db
      .select()
      .from(settings)
      .where(eq(settings.id, "singleton"))
      .limit(1);

    return rows[0] ?? null;
  }

  async update(patch: SettingsPatch): Promise<Settings> {
    // Primero verificamos que existe (si no, el caller tiene un bug grave).
    const current = await this.get();
    if (!current) {
      throw new Error(
        "SettingsRepository.update: la fila singleton no existe. " +
          "Algo en el seed fallo o se borro manualmente.",
      );
    }

    // El UPDATE solo modifica los campos que vengan en `patch`.
    // Drizzle se encarga de no tocar las columnas omitidas.
    await this.db
      .update(settings)
      .set({
        ...patch,
        updatedAt: now(),
      })
      .where(eq(settings.id, "singleton"));

    // Releemos la fila para devolverla actualizada.
    const updated = await this.get();
    if (!updated) {
      throw new Error(
        "SettingsRepository.update: fila desaparecio entre UPDATE y SELECT (?)",
      );
    }

    return updated;
  }
}
