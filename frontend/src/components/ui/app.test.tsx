import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "./button";
import { CheckboxField, ConfirmProvider, useConfirm } from "./app";

function CheckboxHarness() {
  const [checked, setChecked] = useState(false);

  return (
    <>
      <CheckboxField
        label="Escola ativa"
        description="Inativas saem das listagens padrão."
        checked={checked}
        onCheckedChange={setChecked}
      />
      <p>{checked ? "ativa" : "inativa"}</p>
    </>
  );
}

function ConfirmHarness() {
  const confirm = useConfirm();
  const [result, setResult] = useState("pendente");

  return (
    <>
      <Button
        type="button"
        onClick={async () => {
          const ok = await confirm({
            title: "Inativar a escola?",
            description: "O histórico é preservado.",
            confirmLabel: "Inativar",
            destructive: true,
          });
          setResult(ok ? "confirmado" : "cancelado");
        }}
      >
        Abrir confirmação
      </Button>
      <p>{result}</p>
    </>
  );
}

describe("CheckboxField", () => {
  it("reflete a seleção e mantém o rótulo associado", () => {
    render(<CheckboxHarness />);

    const checkbox = screen.getByRole("checkbox", { name: "Escola ativa" });
    expect(checkbox).not.toBeChecked();
    expect(screen.getByText("inativa")).toBeInTheDocument();

    fireEvent.click(checkbox);

    expect(checkbox).toBeChecked();
    expect(screen.getByText("ativa")).toBeInTheDocument();
  });
});

describe("ConfirmProvider", () => {
  it("resolve verdadeiro ao confirmar a ação", async () => {
    render(
      <ConfirmProvider>
        <ConfirmHarness />
      </ConfirmProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Abrir confirmação" }));

    expect(await screen.findByText("Inativar a escola?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Inativar" }));

    await waitFor(() => {
      expect(screen.getByText("confirmado")).toBeInTheDocument();
    });
  });

  it("resolve falso ao cancelar", async () => {
    render(
      <ConfirmProvider>
        <ConfirmHarness />
      </ConfirmProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Abrir confirmação" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));

    await waitFor(() => {
      expect(screen.getByText("cancelado")).toBeInTheDocument();
    });
  });
});
