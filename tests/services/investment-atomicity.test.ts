/**
 * tests/services/investment-atomicity.test.ts
 *
 * Verifica la atomicidad (rollback compensatorio) de las operaciones
 * multi-paso de InvestmentContributionService. Como tauri-plugin-sql usa un
 * pool de conexiones (no hay transaccion SQL fiable), el servicio compensa a
 * mano: si un paso falla, deshace los anteriores. Aqui inyectamos repos falsos
 * y forzamos fallos para comprobar que NO quedan datos a medias (movimiento sin
 * aportacion, inversion vacia, etc.).
 */

import { describe, it, expect } from "vitest";
import { InvestmentContributionService } from "@/lib/services/investment-contribution-service";
import type { DrizzleDb } from "@/lib/db/proxy-driver";

type Row = Record<string, unknown> & { id: string };

class FakeInvestments {
  store = new Map<string, Row>();
  failUpdate = false;
  seed(inv: Row) {
    this.store.set(inv.id, inv);
  }
  async getById(id: string) {
    return this.store.get(id) ?? null;
  }
  async create(data: Record<string, unknown>) {
    const id = (data.id as string) ?? `inv-${this.store.size + 1}`;
    const row = { ...data, id } as Row;
    this.store.set(id, row);
    return row;
  }
  async update(id: string, patch: Record<string, unknown>) {
    if (this.failUpdate) throw new Error("investment update fallo (test)");
    const r = this.store.get(id);
    if (r) this.store.set(id, { ...r, ...patch });
    return this.store.get(id)!;
  }
  async hardDelete(id: string) {
    this.store.delete(id);
  }
}

class FakeMovements {
  store = new Map<string, Row>();
  seq = 0;
  async create(data: Record<string, unknown>) {
    const id = (data.id as string) ?? `mov-${++this.seq}`;
    const row = { ...data, id } as Row;
    this.store.set(id, row);
    return row;
  }
  async hardDelete(id: string) {
    this.store.delete(id);
  }
}

class FakeContributions {
  store = new Map<string, Row>();
  seq = 0;
  failCreate = false;
  async create(data: Record<string, unknown>) {
    if (this.failCreate) throw new Error("contribution create fallo (test)");
    const id = (data.id as string) ?? `c-${++this.seq}`;
    const row = { ...data, id } as Row;
    this.store.set(id, row);
    return row;
  }
  async hardDelete(id: string) {
    this.store.delete(id);
  }
  async listByInvestment(investmentId: string) {
    return [...this.store.values()].filter(
      (r) => r.investmentId === investmentId,
    );
  }
}

function makeService() {
  const inv = new FakeInvestments();
  const mov = new FakeMovements();
  const con = new FakeContributions();
  const svc = new InvestmentContributionService(
    {} as unknown as DrizzleDb,
    inv as never,
    mov as never,
    con as never,
  );
  return { svc, inv, mov, con };
}

const FECHA = new Date(Date.UTC(2026, 5, 15, 12, 0, 0));

function seedAccion(inv: FakeInvestments, over: Partial<Row> = {}) {
  inv.seed({
    id: "inv1",
    tipo: "Acciones",
    nombre: "Test",
    moneda: "EUR",
    participaciones: 0,
    precioCompra: 0,
    precioActual: 5,
    ...over,
  });
}

describe("addContribution — atomicidad", () => {
  it("camino feliz: crea movimiento + aportacion y recalcula", async () => {
    const { svc, inv, mov, con } = makeService();
    seedAccion(inv);

    await svc.addContribution({
      investmentId: "inv1",
      fecha: FECHA,
      participaciones: 10,
      precioUnitario: 5,
      cuentaOrigenId: "acc1",
    });

    expect(mov.store.size).toBe(1);
    expect(con.store.size).toBe(1);
    expect(inv.store.get("inv1")?.participaciones).toBe(10);
  });

  it("si falla crear la aportacion, se DESHACE el movimiento (sin huerfano)", async () => {
    const { svc, inv, mov, con } = makeService();
    seedAccion(inv);
    con.failCreate = true;

    await expect(
      svc.addContribution({
        investmentId: "inv1",
        fecha: FECHA,
        participaciones: 10,
        precioUnitario: 5,
        cuentaOrigenId: "acc1",
      }),
    ).rejects.toThrow();

    expect(mov.store.size).toBe(0); // el movimiento creado se compenso
    expect(con.store.size).toBe(0);
  });

  it("si falla el recalculo, se deshacen movimiento Y aportacion", async () => {
    const { svc, inv, mov, con } = makeService();
    seedAccion(inv);
    inv.failUpdate = true; // recomputeWithValue -> investments.update falla

    await expect(
      svc.addContribution({
        investmentId: "inv1",
        fecha: FECHA,
        participaciones: 10,
        precioUnitario: 5,
        cuentaOrigenId: "acc1",
      }),
    ).rejects.toThrow();

    expect(mov.store.size).toBe(0);
    expect(con.store.size).toBe(0);
  });
});

describe("withdraw — atomicidad", () => {
  it("si falla la fila de retirada, se deshace el movimiento de entrada", async () => {
    const { svc, inv, mov, con } = makeService();
    seedAccion(inv, { participaciones: 10, precioActual: 5 });
    con.failCreate = true;

    await expect(
      svc.withdraw({
        investmentId: "inv1",
        cuentaDestinoId: "acc2",
        fecha: FECHA,
        participaciones: 5,
      }),
    ).rejects.toThrow();

    expect(mov.store.size).toBe(0);
    expect(con.store.size).toBe(0);
  });
});

describe("createWithFirstContribution — atomicidad", () => {
  it("si la primera aportacion falla, se BORRA la inversion (no queda vacia)", async () => {
    const { svc, inv, mov, con } = makeService();
    con.failCreate = true;

    await expect(
      svc.createWithFirstContribution(
        {
          tipo: "Acciones",
          nombre: "Nueva",
          moneda: "EUR",
          participaciones: 0,
          precioCompra: 0,
          precioActual: 5,
        } as never,
        {
          fecha: FECHA,
          participaciones: 10,
          precioUnitario: 5,
          cuentaOrigenId: "acc1",
        },
      ),
    ).rejects.toThrow();

    expect(inv.store.size).toBe(0); // la inversion creada se deshizo
    expect(mov.store.size).toBe(0);
    expect(con.store.size).toBe(0);
  });
});
