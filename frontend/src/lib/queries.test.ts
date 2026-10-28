import { describe, expect, it } from "vitest";

import { buildQuery } from "./queries";

describe("buildQuery", () => {
  it("ignora valores vazios", () => {
    expect(
      buildQuery({ page: 1, search: "", extra: undefined, flag: null }),
    ).toBe("?page=1");
  });

  it("codifica os parâmetros", () => {
    expect(buildQuery({ search: "Escola São José", ativo: true })).toBe(
      "?search=Escola+S%C3%A3o+Jos%C3%A9&ativo=true",
    );
  });

  it("retorna string vazia sem parâmetros", () => {
    expect(buildQuery({})).toBe("");
  });
});
