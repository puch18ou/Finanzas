-- ============================================================================
--  0016_investment_interes.sql
-- ============================================================================
--
--  Lote 16: una inversion (en particular "Cuenta remunerada") puede tener una
--  TAE configurada que se aplica automaticamente al arrancar la app. Solo
--  sube el `precioActual`/valor de la inversion; no genera movimiento.
--
--    tasa_interes:           % anual (TAE). NULL = sin interes automatico.
--    frecuencia_interes:     'mensual' | 'trimestral' | 'anual'. NULL si no aplica.
--    interes_compuesto:      1 = compuesto, 0 = simple. NULL si no aplica.
--    ultimo_interes_aplicado: timestamp (ms) del ultimo periodo aplicado. NULL = nunca.
-- ============================================================================

ALTER TABLE investments ADD COLUMN tasa_interes REAL;
ALTER TABLE investments ADD COLUMN frecuencia_interes TEXT;
ALTER TABLE investments ADD COLUMN interes_compuesto INTEGER;
ALTER TABLE investments ADD COLUMN ultimo_interes_aplicado INTEGER;
