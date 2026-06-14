/**
 * tests/domain/timezone.test.ts
 *
 * Auditoria de zona horaria. La app debe comportarse igual viajes donde
 * viajes. Forzamos el proceso a una zona horaria EXTREMA al este
 * (Pacific/Kiritimati, UTC+14) para demostrar que:
 *
 *   - Una FECHA CIVIL guardada (mediodia UTC) NO se desplaza de dia/mes
 *     aunque el dispositivo este en otra zona (se lee con getUTC*).
 *   - El "mes actual" (currentPeriod) SI usa la hora LOCAL, porque te importa
 *     el calendario del sitio donde estas fisicamente.
 *   - Los INSTANTES (deletedAt...) se muestran en hora LOCAL.
 *
 * En UTC+14, "31 may 2026 12:00 UTC" cae el "1 jun 2026" en hora local: ese
 * es justo el caso que el codigo antiguo (getters locales) archivaba mal.
 */

// Capturamos y forzamos la TZ ANTES de cualquier operacion con Date en los
// callbacks. Node relee la TZ en cada llamada, asi que la mutacion aplica.
const ORIGINAL_TZ = process.env.TZ;
process.env.TZ = "Pacific/Kiritimati";

import { describe, it, expect, afterAll } from "vitest";
import {
  extractPeriod,
  formatDateLong,
  formatInstantLong,
} from "@/lib/utils/dates";
import { currentPeriod } from "@/lib/domain/recurring";
import { monthsBetween } from "@/lib/domain/goals";

afterAll(() => {
  process.env.TZ = ORIGINAL_TZ;
});

// Fecha CIVIL: 31 de mayo de 2026, guardada a mediodia UTC (la convencion).
const may31 = new Date(Date.UTC(2026, 4, 31, 12, 0, 0));

describe("el entorno esta realmente en UTC+14", () => {
  // Si esto fallara, el resto del fichero no probaria nada (estariamos en una
  // TZ donde local == UTC). Lo afirmamos explicitamente.
  it("mediodia UTC del 31-may se ve como 1-jun en hora local", () => {
    expect(may31.getMonth()).toBe(5); // junio (0-indexed) en LOCAL
    expect(may31.getUTCMonth()).toBe(4); // mayo en UTC
  });
});

describe("extractPeriod: la fecha civil no se desplaza al viajar", () => {
  it("31 may 2026 sigue siendo mayo", () => {
    expect(extractPeriod(may31)).toEqual({ mes: 5, anio: 2026 });
  });

  it("31 dic 2026 sigue siendo diciembre (no salta a enero de 2027)", () => {
    const dec31 = new Date(Date.UTC(2026, 11, 31, 12, 0, 0));
    expect(extractPeriod(dec31)).toEqual({ mes: 12, anio: 2026 });
  });

  it("1 ene 2026 sigue siendo enero", () => {
    const jan1 = new Date(Date.UTC(2026, 0, 1, 12, 0, 0));
    expect(extractPeriod(jan1)).toEqual({ mes: 1, anio: 2026 });
  });
});

describe("formatDateLong (fecha civil) usa UTC", () => {
  it("muestra el dia civil elegido, no el local", () => {
    expect(formatDateLong(may31, false)).toBe("31 Mayo 2026");
  });
});

describe("formatInstantLong (instante de auditoria) usa hora LOCAL", () => {
  it("un borrado a las 31 may 12:00 UTC se muestra como 1 jun (UTC+14)", () => {
    expect(formatInstantLong(may31, false)).toBe("1 Junio 2026");
  });
});

describe("currentPeriod usa la hora LOCAL (mes donde estas fisicamente)", () => {
  it("a las 31 may 23:00 UTC, en UTC+14 ya estas en junio", () => {
    const inst = new Date("2026-05-31T23:00:00Z");
    expect(currentPeriod(inst)).toEqual({ mes: 6, anio: 2026 });
  });
});

describe("monthsBetween usa UTC en ambos extremos", () => {
  it("de 15 jun a 15 dic 2026 = 6 meses aunque la TZ desplace el dia", () => {
    const from = new Date(Date.UTC(2026, 5, 15, 12, 0, 0));
    const to = new Date(Date.UTC(2026, 11, 15, 12, 0, 0));
    expect(monthsBetween(from, to)).toBe(6);
  });

  it("fin de mes: de 31 may a 31 jul 2026 = 2 meses", () => {
    const from = new Date(Date.UTC(2026, 4, 31, 12, 0, 0));
    const to = new Date(Date.UTC(2026, 6, 31, 12, 0, 0));
    expect(monthsBetween(from, to)).toBe(2);
  });
});
