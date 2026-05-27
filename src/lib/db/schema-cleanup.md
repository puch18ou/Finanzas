// ============================================================================
//  CAMBIOS A APLICAR EN src/lib/db/schema.ts
// ============================================================================
//
//  Lote 11b elimina la tabla monthly_incomes definitivamente. Hay que
//  reflejarlo en el schema:
//
//  PASO 1: BORRA EL BLOQUE COMPLETO
//          `export const monthlyIncomes = sqliteTable("monthly_incomes", ...);`
//          (todo el bloque, desde "export const monthlyIncomes" hasta el cierre `);`)
//
//  PASO 2: En el bloque de tipos al final del archivo, BORRA ESTAS LINEAS:
//
//          export type MonthlyIncome = typeof monthlyIncomes.$inferSelect;
//          export type NewMonthlyIncome = typeof monthlyIncomes.$inferInsert;
//
//  Eso es todo. El resto del schema queda igual.
// ============================================================================
