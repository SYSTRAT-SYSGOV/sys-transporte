import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Select nativo com a aparência do design system.
 * Mantém a acessibilidade e o comportamento nativo do navegador em formulários densos.
 */
function NativeSelect({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn("native-select", className)}
      {...props}
    >
      {children}
    </select>
  );
}

export { NativeSelect };
