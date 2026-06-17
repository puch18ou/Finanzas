-- ============================================================================
--  0030_rename_roboadvisor_cartera.sql
-- ============================================================================
--
--  El tipo de inversion "Robo-advisor" pasa a llamarse "Cartera de fondos":
--  modela un conjunto de fondos (sin un ISIN ni VL unico) cuyo valor total se
--  introduce a mano (modo "solo dinero", igual que antes). Las inversiones
--  existentes con tipo='Robo-advisor' se renombran para que sigan apareciendo
--  en su pestana del catalogo.
--
--  Es solo dato (UPDATE), no toca esquema. Si no hay ninguna fila con ese tipo,
--  es un no-op. Bump de updated_at para que el sync LWW propague el cambio.
-- ============================================================================

UPDATE investments
SET tipo = 'Cartera de fondos', updated_at = (CAST(strftime('%s','now') AS INTEGER) * 1000)
WHERE tipo = 'Robo-advisor';
