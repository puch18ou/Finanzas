/**
 * Tests de src/lib/auth/pin.ts
 *
 * Ejecutar con: npm test
 */

import { describe, it, expect } from "vitest";
import { hashPin, verifyPin, validatePinFormat } from "@/lib/auth/pin";

describe("validatePinFormat", () => {
  it("acepta PINs de 4 a 8 digitos", () => {
    expect(validatePinFormat("7410")).toBe(true);
    expect(validatePinFormat("0000")).toBe(true);
    expect(validatePinFormat("12345678")).toBe(true);
  });

  it("rechaza PINs demasiado cortos o largos", () => {
    expect(validatePinFormat("123")).toBe(false);
    expect(validatePinFormat("123456789")).toBe(false);
    expect(validatePinFormat("")).toBe(false);
  });

  it("rechaza PINs con caracteres no numericos", () => {
    expect(validatePinFormat("12a4")).toBe(false);
    expect(validatePinFormat("12 4")).toBe(false);
    expect(validatePinFormat(" 1234")).toBe(false);
  });
});

describe("hashPin / verifyPin", () => {
  it("verifica correctamente el PIN original", async () => {
    const { hash, salt } = await hashPin("7410");
    expect(await verifyPin("7410", hash, salt)).toBe(true);
  });

  it("rechaza un PIN incorrecto", async () => {
    const { hash, salt } = await hashPin("7410");
    expect(await verifyPin("0000", hash, salt)).toBe(false);
  });

  it("genera salts distintos en cada llamada (hashes distintos para el mismo PIN)", async () => {
    const a = await hashPin("1234");
    const b = await hashPin("1234");
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
    // pero ambos verifican el mismo PIN
    expect(await verifyPin("1234", a.hash, a.salt)).toBe(true);
    expect(await verifyPin("1234", b.hash, b.salt)).toBe(true);
  });
});
