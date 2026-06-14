/**
 * tests/domain/tags.test.ts — etiquetas de movimientos.
 */

import { describe, it, expect } from "vitest";
import { parseTags, serializeTags, hasTag, allTags } from "@/lib/domain/tags";

describe("parseTags", () => {
  it("vacio / null -> []", () => {
    expect(parseTags(null)).toEqual([]);
    expect(parseTags("")).toEqual([]);
    expect(parseTags("  ,  , ")).toEqual([]);
  });
  it("normaliza (minusculas, espacios) y quita duplicados", () => {
    expect(parseTags("Viaje Japón,  amigos , viaje japón ")).toEqual([
      "viaje japón",
      "amigos",
    ]);
    expect(parseTags("A,a,A")).toEqual(["a"]);
  });
});

describe("serializeTags", () => {
  it("texto crudo -> lista normalizada por comas", () => {
    expect(serializeTags("  Trabajo,  trabajo , Ocio ")).toBe("trabajo,ocio");
  });
  it("array -> lista", () => {
    expect(serializeTags(["Casa", "casa", "luz"])).toBe("casa,luz");
  });
  it("vacio -> null", () => {
    expect(serializeTags("")).toBe(null);
    expect(serializeTags(null)).toBe(null);
    expect(serializeTags("  ,  ")).toBe(null);
  });
});

describe("hasTag", () => {
  it("insensible a mayusculas/espacios", () => {
    expect(hasTag("viaje japón,amigos", "Viaje Japón")).toBe(true);
    expect(hasTag("viaje japón,amigos", "trabajo")).toBe(false);
    expect(hasTag(null, "x")).toBe(false);
  });
});

describe("allTags", () => {
  it("union ordenada de todas las etiquetas", () => {
    const movs = [
      { etiquetas: "casa,luz" },
      { etiquetas: "luz,agua" },
      { etiquetas: null },
      { etiquetas: "" },
    ];
    expect(allTags(movs)).toEqual(["agua", "casa", "luz"]);
  });
});
