/**
 * ============================================================================
 *  src/lib/help/changelog.ts — Novedades por versión
 * ============================================================================
 *
 *  Lista de versiones (mas reciente primero) con sus cambios, CORTOS y
 *  concisos. Se usa para:
 *    - El aviso "Novedades" al actualizar (muestra las versiones que te has
 *      saltado desde la ultima que viste en este dispositivo).
 *    - El historial completo en Ajustes.
 *
 *  Al publicar una version nueva: añade su entrada ARRIBA y sube la version en
 *  package.json / tauri.conf.json / Cargo.toml a la misma.
 * ============================================================================
 */

export type ChangelogEntry = {
  version: string;
  fecha: string; // "AAAA-MM"
  cambios: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.1.23",
    fecha: "2026-08",
    cambios: [
      "Ayuda guiada («?») en cada pantalla: un recorrido que resalta cada elemento y explica para qué sirve.",
      "Botón de guía del menú (junto a «Finanzas») que recorre todas las secciones.",
      "Aviso de novedades al actualizar, con las versiones que te has saltado.",
      "Historial completo de versiones en Ajustes.",
      "Cuentas: se pueden archivar (cerrar, con saldo a 0) en vez de borrarlas.",
      "No se pueden borrar cuentas, categorías ni monedas que estén en uso (solo editar), con aviso del motivo.",
      "Divisa por defecto EUR en instalaciones nuevas.",
      "Al crear una moneda, su tipo de cambio se actualiza solo.",
      "Arreglo: los tipos de cambio ya no fallan por monedas no cubiertas (p. ej. peso argentino).",
      "El botón de ocultar importes pasa a la barra lateral.",
    ],
  },
  {
    version: "0.1.22",
    fecha: "2026-08",
    cambios: [
      "Recurrentes flexibles: además de mensual, ahora semanal, anual y «varios días al mes» (p. ej. días 1 y 15).",
      "Los gastos previstos de estas reglas se reflejan en dashboard, presupuestos y movimientos.",
      "Evolución: nueva vista para comparar años (una línea por año) con tabla de variación %.",
      "Evolución: nueva vista por categoría, para ver el gasto mes a mes de una o varias categorías.",
      "No se pueden borrar categorías ni monedas que estén en uso.",
    ],
  },
  {
    version: "0.1.21",
    fecha: "2026-08",
    cambios: [
      "Modo privacidad: un botón oculta todos los importes de la app (se ven como ••••), manteniendo nombres, fechas y porcentajes.",
      "Es local de cada dispositivo y afecta también a gráficas y participaciones.",
    ],
  },
  {
    version: "0.1.19",
    fecha: "2026-08",
    cambios: [
      "Android: las actualizaciones se descargan e instalan dentro de la propia app, sin pasar por el navegador.",
    ],
  },
  {
    version: "0.1.18",
    fecha: "2026-08",
    cambios: [
      "Presupuestos desplegables: puedes abrir cada presupuesto para ver en qué se ha gastado.",
      "Las devoluciones se descuentan del gasto (coste real).",
      "Movimientos: ordenar por fecha/concepto/importe/categoría, buscar, y filtrar por rango de fechas, con total de gasto neto.",
    ],
  },
  {
    version: "0.1.13",
    fecha: "2026-06",
    cambios: [
      "Devoluciones asociadas a un gasto: se reflejan como coste real del gasto, sin contar como ingreso.",
    ],
  },
  {
    version: "0.1.11",
    fecha: "2026-06",
    cambios: ["Los presupuestos se definen en su moneda local."],
  },
  {
    version: "0.1.10",
    fecha: "2026-06",
    cambios: ["Copias de seguridad separadas por usuario (privacidad multiusuario)."],
  },
  {
    version: "0.1.8",
    fecha: "2026-06",
    cambios: ["Sincronización PC–móvil más rápida y estable al arrancar."],
  },
  {
    version: "0.1.1",
    fecha: "2026-06",
    cambios: ["Auto-actualización de la app (descarga e instala las versiones nuevas)."],
  },
  {
    version: "0.1.0",
    fecha: "2026-06",
    cambios: [
      "Primera versión: cuentas, movimientos, presupuestos, inversiones, hipoteca, deudas y metas.",
      "Multi-moneda y sincronización directa PC–móvil por red local (sin nube).",
    ],
  },
];

export const LATEST_VERSION = CHANGELOG[0]?.version ?? "";

/** Compara versiones "x.y.z": >0 si a>b, <0 si a<b, 0 si iguales. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * Entradas más nuevas que `version` (la última vista). Si es null (primera vez
 * con esta función), devuelve solo la última, a modo de bienvenida.
 */
export function entriesNewerThan(version: string | null): ChangelogEntry[] {
  if (!version) return CHANGELOG.length > 0 ? [CHANGELOG[0]!] : [];
  return CHANGELOG.filter((e) => compareVersions(e.version, version) > 0);
}
