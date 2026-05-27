// ============================================================================
//  CAMBIOS A APLICAR EN src/lib/db/schema.ts
// ============================================================================
//
//  Lote 10a-2 elimina las tablas expenses y extra_incomes. Hay que
//  reflejarlo en el schema:
//
//  PASO 1: BORRA EL BLOQUE COMPLETO `export const expenses = sqliteTable(...)`
//          (todo el bloque, desde "export const expenses" hasta el cierre `);`)
//
//  PASO 2: BORRA EL BLOQUE COMPLETO `export const extraIncomes = sqliteTable(...)`
//
//  PASO 3: En el bloque de tipos al final del archivo, BORRA ESTAS LINEAS:
//
//          export type Expense = typeof expenses.$inferSelect;
//          export type NewExpense = typeof expenses.$inferInsert;
//          export type ExtraIncome = typeof extraIncomes.$inferSelect;
//          export type NewExtraIncome = typeof extraIncomes.$inferInsert;
//
//  Eso es todo. El resto del schema queda igual.
// ============================================================================
