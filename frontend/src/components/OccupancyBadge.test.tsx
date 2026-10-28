import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OccupancyBadge } from "./OccupancyBadge";

describe("OccupancyBadge", () => {
  it("exibe ocupação normal", () => {
    render(<OccupancyBadge allocated={10} capacity={40} percentage={25} />);
    expect(screen.getByText("10/40")).toBeInTheDocument();
    expect(screen.getByText("25,00%")).toBeInTheDocument();
  });

  it("sinaliza superlotação", () => {
    render(<OccupancyBadge allocated={45} capacity={40} percentage={112.5} />);
    const badge = screen.getByText("112,50%");
    expect(badge).toHaveClass("text-critical-strong");
  });

  it("mostra ausência de dados quando a rota não tem veículo", () => {
    render(<OccupancyBadge allocated={0} capacity={null} percentage={null} />);
    expect(screen.getByText("Sem dados")).toBeInTheDocument();
  });
});
