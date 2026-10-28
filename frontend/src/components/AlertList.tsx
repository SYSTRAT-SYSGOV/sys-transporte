import { CalendarDays, CircleAlert, TriangleAlert } from "lucide-react";

import type { Alert } from "@/api/types";
import { formatDate } from "@/lib/format";
import { Badge } from "./ui/badge";
import { cn } from "@sysgov/ui";

export function AlertList({
  alerts,
  limit,
  empty = "Nenhum alerta no período.",
}: {
  alerts: Alert[];
  limit?: number;
  empty?: string;
}) {
  const list = limit ? alerts.slice(0, limit) : alerts;

  if (list.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-sm text-muted-foreground">
        {empty}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border/70">
      {list.map((alert) => {
        const critical = alert.severity === "critical";

        return (
          <li
            key={`${alert.kind}-${alert.resource_id}-${alert.due_date}`}
            className="flex gap-3 py-3"
          >
            <span
              className={cn(
                "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border",
                critical
                  ? "border-critical-border bg-critical-surface text-critical"
                  : "border-warning-border bg-warning-surface text-warning",
              )}
              aria-hidden
            >
              {critical ? (
                <CircleAlert className="size-4" />
              ) : (
                <TriangleAlert className="size-4" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={critical ? "critical" : "warning"}>
                  {critical ? "Crítico" : "Atenção"}
                </Badge>
                <p className="truncate text-sm font-medium text-foreground">
                  {alert.title}
                </p>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {alert.detail}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-[11px] text-gov-text-muted">
                <CalendarDays className="size-3" aria-hidden />
                Vencimento{" "}
                <span className="font-mono">{formatDate(alert.due_date)}</span>
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
