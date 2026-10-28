import { describe, expect, it } from "vitest";

import {
  emptyToNull,
  formatPercent,
  numberOrNull,
  occupancyStatus,
  timeOrNull,
  toTimeInput,
} from "./format";

describe("formatadores", () => {
  it("formata percentuais com duas casas", () => {
    expect(formatPercent(93.456)).toBe("93,46%");
    expect(formatPercent(null)).toBe("—");
  });

  it("classifica a ocupação da rota", () => {
    expect(occupancyStatus(null)).toBe("unknown");
    expect(occupancyStatus(50)).toBe("ok");
    expect(occupancyStatus(80)).toBe("ok");
    expect(occupancyStatus(80.01)).toBe("warning");
    expect(occupancyStatus(100)).toBe("warning");
    expect(occupancyStatus(100.5)).toBe("critical");
  });

  it("converte entradas numéricas e horárias", () => {
    expect(numberOrNull("  ")).toBeNull();
    expect(numberOrNull("12,5")).toBe(12.5);
    expect(numberOrNull("abc")).toBeNull();
    expect(timeOrNull("07:30")).toBe("07:30:00");
    expect(timeOrNull("")).toBeNull();
    expect(toTimeInput("07:30:00")).toBe("07:30");
    expect(toTimeInput(null)).toBe("");
  });

  it("normaliza campos opcionais de texto", () => {
    expect(emptyToNull("   ")).toBeNull();
    expect(emptyToNull("  valor ")).toBe("valor");
  });
});
