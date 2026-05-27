/**
 * ============================================================================
 *  src/lib/domain/projection.ts — Proyeccion de patrimonio futuro
 * ============================================================================
 *
 *  Modela como evoluciona tu patrimonio neto a lo largo de N anios dado:
 *    - patrimonio inicial
 *    - ahorro anual esperado
 *    - rentabilidad anual esperada (porcentaje del patrimonio que crece
 *      anualmente por intereses, dividendos, plusvalia)
 *    - inflacion anual esperada (para descontar el resultado en terminos
 *      reales)
 *
 *  FORMULA
 *  -------
 *  Cada anio: patrimonio_nuevo = (patrimonio + ahorro_anual) * (1 + rentabilidad)
 *
 *  El ajuste por inflacion se aplica al final dividiendo cada valor por
 *  (1 + inflacion)^anio. Esto da el valor en terminos del poder adquisitivo
 *  de hoy.
 *
 *  ASUNCIONES
 *  ----------
 *  - El ahorro entra al INICIO del anio (no a final). Esto da resultados
 *    ligeramente superiores. Es lo que asumiremos por simplicidad.
 *  - La rentabilidad se aplica sobre el patrimonio incluyendo el ahorro
 *    del anio. Tambien simplificacion conservadora razonable.
 *  - El ahorro anual es CONSTANTE (no se ajusta por inflacion). Si el
 *    usuario aspira a que su salario crezca al ritmo de la inflacion,
 *    deberia poner el ahorro real, no nominal.
 *
 *  Estas asunciones se pueden refinar con un selector "ahorro nominal vs
 *  real" en una pantalla de configuracion avanzada, mas adelante.
 * ============================================================================
 */

/**
 * Una fila del calendario de proyeccion: un anio futuro y los valores
 * nominales y reales del patrimonio al final de ese anio.
 */
export type ProjectionRow = {
  /** desplazamiento desde hoy en anios (0 = hoy, 1 = dentro de 1 anio…) */
  anio: number;
  /** patrimonio nominal (sin descontar inflacion) */
  patrimonioNominal: number;
  /** patrimonio real (descontada la inflacion acumulada) */
  patrimonioReal: number;
};

/**
 * Genera la proyeccion completa para un horizonte de N anios.
 *
 * @param patrimonioInicial  patrimonio neto en el anio 0
 * @param ahorroAnual        cantidad fija que se aporta cada anio
 * @param rentabilidadAnual  rentabilidad anual como decimal (0.05 = 5%)
 * @param inflacionAnual     inflacion anual como decimal (0.025 = 2.5%)
 * @param anios              horizonte de proyeccion
 * @returns array de anios + 1 filas (incluyendo el anio 0)
 */
export function projectPatrimony(
  patrimonioInicial: number,
  ahorroAnual: number,
  rentabilidadAnual: number,
  inflacionAnual: number,
  anios: number,
): ProjectionRow[] {
  const rows: ProjectionRow[] = [];

  // Anio 0: estado actual.
  rows.push({
    anio: 0,
    patrimonioNominal: patrimonioInicial,
    patrimonioReal: patrimonioInicial,
  });

  let patrimonio = patrimonioInicial;

  for (let a = 1; a <= anios; a++) {
    patrimonio = (patrimonio + ahorroAnual) * (1 + rentabilidadAnual);

    const factorInflacion = Math.pow(1 + inflacionAnual, a);
    const patrimonioReal = patrimonio / factorInflacion;

    rows.push({
      anio: a,
      patrimonioNominal: patrimonio,
      patrimonioReal,
    });
  }

  return rows;
}
