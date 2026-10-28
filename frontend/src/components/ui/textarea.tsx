import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-[76px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground shadow-xs transition-[color,box-shadow] outline-none",
        "placeholder:text-muted-foreground/80",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        "disabled:cursor-not-allowed disabled:bg-muted/50 disabled:opacity-70",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
