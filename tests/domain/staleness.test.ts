/**
 * tests/domain/staleness.test.ts — antiguedad y nivel de frescura de datos.
 */

import { describe, it, expect } from "vitest";
import { timeAgo, daysSince, stalenessLevel } from "@/lib/utils/staleness";

const NOW = new Date("2026-06-15T12:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

describe("timeAgo", () => {
  it("null -> nunca", () => {
    expect(timeAgo(null, NOW)).toBe("nunca");
  });
  it("muy reciente -> ahora mismo", () => {
    expect(timeAgo(ago(30_000), NOW)).toBe("ahora mismo");
  });
  it("minutos y horas", () => {
    expect(timeAgo(ago(5 * MIN), NOW)).toBe("hace 5 min");
    expect(timeAgo(ago(3 * HOUR), NOW)).toBe("hace 3 h");
  });
  it("ayer y dias", () => {
    expect(timeAgo(ago(1 * DAY), NOW)).toBe("ayer");
    expect(timeAgo(ago(4 * DAY), NOW)).toBe("hace 4 dias");
  });
  it("semanas y meses", () => {
    expect(timeAgo(ago(14 * DAY), NOW)).toBe("hace 2 semanas");
    expect(timeAgo(ago(90 * DAY), NOW)).toBe("hace 3 meses");
  });
});

describe("daysSince", () => {
  it("null -> null; mismo instante -> 0; futuro -> 0", () => {
    expect(daysSince(null, NOW)).toBe(null);
    expect(daysSince(NOW, NOW)).toBe(0);
    expect(daysSince(new Date(NOW.getTime() + DAY), NOW)).toBe(0);
  });
  it("cuenta dias enteros", () => {
    expect(daysSince(ago(3 * DAY + HOUR), NOW)).toBe(3);
  });
});

describe("stalenessLevel", () => {
  const opts = { warnDays: 3, staleDays: 8 };
  it("never / fresh / warn / stale", () => {
    expect(stalenessLevel(null, opts, NOW)).toBe("never");
    expect(stalenessLevel(ago(1 * DAY), opts, NOW)).toBe("fresh");
    expect(stalenessLevel(ago(5 * DAY), opts, NOW)).toBe("warn");
    expect(stalenessLevel(ago(10 * DAY), opts, NOW)).toBe("stale");
  });
});
