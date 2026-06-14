/**
 * tests/domain/sync-e2e.test.ts
 *
 * Tests END-TO-END de sincronizacion sobre el harness en memoria (MemStore +
 * SyncSession), cubriendo escenarios REALES que los tests unitarios no tocan:
 *
 *   1. Topologia HUB: PC como servidor + dos moviles. Un cambio en un movil
 *      llega al otro A TRAVES del PC (varias rondas).
 *   2. El bug que motivo los ids deterministas: dos dispositivos materializan
 *      la MISMA ocurrencia periodica; con id determinista NO se duplica.
 *   3. Secuencia larga e interleaved (altas/ediciones/borrados/resurreccion)
 *      que converge y queda idempotente.
 */

import { describe, it, expect } from "vitest";
import { bidirectionalSync } from "@/lib/domain/sync-session";
import { autoGenId } from "@/lib/domain/auto-id";
import { makeDevice, row } from "../helpers/mem-sync-store";

describe("topologia HUB (PC + 2 moviles)", () => {
  it("un alta en el movil 1 llega al movil 2 a traves del PC", async () => {
    const pc = makeDevice("pc");
    const p1 = makeDevice("movil-1");
    const p2 = makeDevice("movil-2");

    // El movil 1 crea una cuenta.
    p1.store.put("accounts", row("acc1", 100, "Cuenta movil 1"));

    // Ronda A: movil 1 <-> PC (el PC, hub, recibe la cuenta).
    await bidirectionalSync(p1, pc);
    expect(pc.store.count("accounts")).toBe(1);

    // Ronda B: movil 2 <-> PC (el movil 2 la recibe del hub).
    await bidirectionalSync(p2, pc);

    expect(p2.store.snapshot("accounts")).toEqual(p1.store.snapshot("accounts"));
    expect(p2.store.snapshot("accounts")).toHaveLength(1);
  });

  it("cambios cruzados en ambos moviles convergen via el PC", async () => {
    const pc = makeDevice("pc");
    const p1 = makeDevice("movil-1");
    const p2 = makeDevice("movil-2");

    p1.store.put("movements", row("m1", 100, "gasto p1"));
    p2.store.put("movements", row("m2", 110, "gasto p2"));

    // Cada movil sincroniza con el PC...
    await bidirectionalSync(p1, pc);
    await bidirectionalSync(p2, pc);
    // ...y una segunda pasada lleva a cada uno lo del otro.
    await bidirectionalSync(p1, pc);

    expect(p1.store.snapshot("movements")).toEqual(pc.store.snapshot("movements"));
    expect(p2.store.snapshot("movements")).toEqual(pc.store.snapshot("movements"));
    expect(pc.store.snapshot("movements")).toHaveLength(2);
  });

  it("un borrado en el movil 1 llega al movil 2 via el PC", async () => {
    const pc = makeDevice("pc");
    const p1 = makeDevice("movil-1");
    const p2 = makeDevice("movil-2");

    // La fila existe en los tres.
    p1.store.put("goals", row("g1", 100, "meta"));
    await bidirectionalSync(p1, pc);
    await bidirectionalSync(p2, pc);
    expect(p2.store.count("goals")).toBe(1);

    // El movil 1 la borra (lapida) y sincroniza con el PC.
    p1.store.purge("goals", "g1", 300);
    await bidirectionalSync(p1, pc);
    expect(pc.store.count("goals")).toBe(0);

    // El movil 2 sincroniza con el PC y tambien la pierde.
    await bidirectionalSync(p2, pc);
    expect(p2.store.count("goals")).toBe(0);
  });
});

describe("ids deterministas: filas periodicas no se duplican", () => {
  it("la misma ocurrencia generada en dos dispositivos colapsa en una fila", async () => {
    const pc = makeDevice("pc");
    const phone = makeDevice("movil");

    // Ambos materializan el movimiento recurrente de junio 2026 de la misma
    // regla -> MISMO id determinista (lo que hace recurring-service).
    const id = autoGenId("rmov", "regla-nomina", "2026-6");
    pc.store.put("movements", row(id, 120, "nomina (PC)"));
    phone.store.put("movements", row(id, 100, "nomina (movil)"));

    await bidirectionalSync(phone, pc);

    // UNA sola fila (no duplicada) y gana la mas reciente (PC, t=120).
    expect(pc.store.snapshot("movements")).toEqual(phone.store.snapshot("movements"));
    expect(pc.store.snapshot("movements")).toHaveLength(1);
    expect(pc.store.snapshot("movements")[0]?.v).toBe("nomina (PC)");
  });

  it("CONTRASTE: si los ids fueran aleatorios (distintos) si se duplicaria", async () => {
    const pc = makeDevice("pc");
    const phone = makeDevice("movil");

    // Misma ocurrencia conceptual, pero con ids aleatorios distintos (el bug
    // que los ids deterministas evitan).
    pc.store.put("movements", row("rnd-aaa", 120, "nomina (PC)"));
    phone.store.put("movements", row("rnd-bbb", 100, "nomina (movil)"));

    await bidirectionalSync(phone, pc);

    // Quedan DOS filas: justo lo que NO queremos (documenta el porque).
    expect(pc.store.snapshot("movements")).toHaveLength(2);
  });
});

describe("secuencia larga interleaved converge y es idempotente", () => {
  it("altas, ediciones, borrado y resurreccion terminan iguales", async () => {
    const a = makeDevice("device-A");
    const b = makeDevice("device-B");

    // t=100: A crea dos categorias; B crea una cuenta.
    a.store.put("categories", row("cat1", 100, "Comida"));
    a.store.put("categories", row("cat2", 100, "Ocio"));
    b.store.put("accounts", row("acc1", 100, "Banco"));
    await bidirectionalSync(a, b);

    // t=200: B edita cat1; A edita acc1 (concurrente, distinto registro).
    b.store.put("categories", row("cat1", 200, "Comida y casa"));
    a.store.put("accounts", row("acc1", 200, "Banco principal"));
    await bidirectionalSync(a, b);

    // t=300: A borra cat2; B la vuelve a tocar mas tarde (t=350) -> resucita.
    a.store.purge("categories", "cat2", 300);
    b.store.put("categories", row("cat2", 350, "Ocio y viajes"));
    await bidirectionalSync(a, b);

    // Convergencia total.
    expect(a.store.snapshot("categories")).toEqual(b.store.snapshot("categories"));
    expect(a.store.snapshot("accounts")).toEqual(b.store.snapshot("accounts"));

    // cat1 editada, cat2 resucitada (la edicion t=350 gana a la lapida t=300).
    const cats = a.store.snapshot("categories");
    expect(cats).toHaveLength(2);
    expect(cats.find((c) => c.id === "cat1")?.v).toBe("Comida y casa");
    expect(cats.find((c) => c.id === "cat2")?.v).toBe("Ocio y viajes");
    expect(a.store.snapshot("accounts")[0]?.v).toBe("Banco principal");

    // Idempotencia: otra ronda sin cambios no aplica ni borra nada.
    const again = await bidirectionalSync(a, b);
    expect(again.a.appliedRows).toBe(0);
    expect(again.b.appliedRows).toBe(0);
    expect(again.a.deletedRows).toBe(0);
    expect(again.b.deletedRows).toBe(0);
  });
});
