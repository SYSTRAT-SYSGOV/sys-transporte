import { formatPercent, occupancyStatus, statusLabel } from "@/lib/format";
import { Badge } from "./ui/badge";
import { Progress, type ProgressTone } from "./ui/progress";

const toneByStatus: Record<string, ProgressTone> = {
  ok: "ok",
  warning: "warning",
  critical: "critical",
  unknown: "neutral",
};

const badgeByStatus = {
  ok: "success",
  warning: "warning",
  critical: "critical",
  unknown: "neutral",
} as const;

export function OccupancyBadge({
  allocated,
  capacity,
  percentage,
}: {
  allocated: number;
  capacity?: number | null;
  percentage?: number | null;
}) {
  const status = occupancyStatus(percentage);
  const value = Math.min(Math.max(percentage ?? 0, 0), 100);

  return (
    <div className="min-w-[136px]">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-semibold text-foreground tabular-nums">
          {allocated}/{capacity ?? "—"}
        </span>
        <Badge
          variant={badgeByStatus[status]}
          className="font-mono tabular-nums"
        >
          {percentage === null || percentage === undefined
            ? statusLabel(status)
            : formatPercent(percentage)}
        </Badge>
      </div>
      <Progress
        className="mt-1.5"
        value={value}
        tone={toneByStatus[status]}
        label={`Lotação: ${allocated} de ${capacity ?? "sem capacidade definida"}`}
      />
    </div>
  );
}
