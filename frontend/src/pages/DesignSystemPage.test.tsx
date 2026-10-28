import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ConfirmProvider, TooltipProvider } from "@sysgov/ui";
import DesignSystemPage from "./DesignSystemPage";

describe("DesignSystemPage", () => {
  it("renderiza tokens e abas de componentes", () => {
    render(
      <TooltipProvider>
        <ConfirmProvider>
          <DesignSystemPage />
        </ConfirmProvider>
      </TooltipProvider>,
    );

    expect(
      screen.getByRole("heading", { name: "Design system SYSGOV" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Primary (GOV.BR)")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Ações" })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Formulários" }),
    ).toBeInTheDocument();
  }, 15_000);
});
