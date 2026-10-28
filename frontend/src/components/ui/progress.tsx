import { cn } from "@/lib/utils";

const tones = {
  ok: "[&::-webkit-progress-value]:bg-success [&::-moz-progress-bar]:bg-success",
  success:
    "[&::-webkit-progress-value]:bg-success [&::-moz-progress-bar]:bg-success",
  warning:
    "[&::-webkit-progress-value]:bg-warning [&::-moz-progress-bar]:bg-warning",
  critical:
    "[&::-webkit-progress-value]:bg-critical [&::-moz-progress-bar]:bg-critical",
  info: "[&::-webkit-progress-value]:bg-info [&::-moz-progress-bar]:bg-info",
  neutral:
    "[&::-webkit-progress-value]:bg-neutral-strong [&::-moz-progress-bar]:bg-neutral-strong",
} as const;

export type ProgressTone = keyof typeof tones;

/** Barra de progresso nativa e acessível usada em indicadores de lotação. */
export function Progress({
  value,
  tone = "ok",
  className,
  label,
}: {
  value: number;
  tone?: ProgressTone;
  className?: string;
  label?: string;
}) {
  const clamped = Math.min(Math.max(value, 0), 100);

  return (
    <progress
      value={clamped}
      max={100}
      aria-label={label}
      className={cn(
        "h-1.5 w-full appearance-none overflow-hidden rounded-full border-0 bg-muted",
        "[&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-muted",
        tones[tone],
        className,
      )}
    />
  );
}
