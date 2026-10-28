export function formatDate(value?: string | null): string {
  if (!value) {
    return "—";
  }
  const date = new Date(`${value}${value.length === 10 ? "T00:00:00" : ""}`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("pt-BR");
}

export function formatDateTime(value?: string | null): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function formatNumber(value?: number | null, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  return value.toLocaleString("pt-BR", { maximumFractionDigits: digits });
}

export function formatPercent(value?: number | null): string {
  if (value === null || value === undefined) {
    return "—";
  }
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

export function toDateInput(value?: string | null): string {
  return value ? value.slice(0, 10) : "";
}

export function toTimeInput(value?: string | null): string {
  return value ? value.slice(0, 5) : "";
}

export function timeOrNull(value: string): string | null {
  return value ? `${value}:00` : null;
}

export function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function numberOrNull(value: string): number | null {
  if (value.trim() === "") {
    return null;
  }
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function occupancyStatus(
  percentage?: number | null,
): "ok" | "warning" | "critical" | "unknown" {
  if (percentage === null || percentage === undefined) {
    return "unknown";
  }
  if (percentage > 100) {
    return "critical";
  }
  if (percentage > 80) {
    return "warning";
  }
  return "ok";
}

export function statusLabel(status: string): string {
  return (
    {
      ok: "Normal",
      warning: "Atenção",
      critical: "Crítico",
      unknown: "Sem dados",
      active: "Ativa",
      closed: "Encerrada",
    }[status] ?? status
  );
}
