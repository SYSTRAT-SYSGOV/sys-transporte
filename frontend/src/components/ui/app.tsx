import {
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useId,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { CircleAlert, Inbox, Search } from "lucide-react";

import { Alert, AlertDescription } from "./alert";
import { Badge } from "./badge";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Checkbox } from "./checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { Input } from "./input";
import { Label } from "./label";
import { Skeleton } from "./skeleton";
import { Switch } from "./switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

const statAccents = {
  primary: "border-gov-primary-border bg-gov-primary-light text-gov-primary",
  info: "border-info-border bg-info-surface text-info-strong",
  warning: "border-warning-border bg-warning-surface text-warning-strong",
  critical: "border-critical-border bg-critical-surface text-critical-strong",
  neutral: "border-neutral-border bg-neutral-surface text-neutral-strong",
} as const;

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent = "primary",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  accent?: keyof typeof statAccents;
}) {
  return (
    <Card className="gap-0 overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-bold tracking-[0.06em] text-muted-foreground uppercase">
            {label}
          </p>
          {icon && (
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-md border [&_svg]:size-4",
                statAccents[accent],
              )}
              aria-hidden
            >
              {icon}
            </span>
          )}
        </div>
        <div className="mt-2 font-mono text-2xl font-bold tracking-tight text-gov-blue-dark tabular-nums">
          {value}
        </div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {action}
      </CardHeader>
      <CardContent className={cn("p-0", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={wide ? "sm:max-w-4xl" : "sm:max-w-2xl"}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>
        </DialogHeader>
        <div className="px-6 py-4">{children}</div>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}

export interface Column<T> {
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  numeric?: boolean;
}

export function DataTable<T>({
  columns,
  rows,
  loading,
  empty,
  keyOf,
}: {
  columns: Column<T>[];
  rows: T[] | undefined;
  loading?: boolean;
  empty?: string;
  keyOf: (row: T) => string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {columns.map((column) => (
            <TableHead
              key={column.header}
              className={cn(column.numeric && "text-right", column.className)}
            >
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading &&
          Array.from({ length: 5 }).map((_, index) => (
            <TableRow key={`skeleton-${index}`}>
              {columns.map((column) => (
                <TableCell key={column.header}>
                  <Skeleton className="h-3.5 w-full max-w-[180px]" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        {!loading &&
          rows?.map((row) => (
            <TableRow key={keyOf(row)}>
              {columns.map((column) => (
                <TableCell
                  key={column.header}
                  className={cn(
                    column.numeric && "text-right font-mono tabular-nums",
                    column.className,
                  )}
                >
                  {column.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        {!loading && rows && rows.length === 0 && (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={columns.length} className="py-12 text-center">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Inbox
                  className="size-6 text-muted-foreground/60"
                  aria-hidden
                />
                <span className="text-sm">
                  {empty ?? "Nenhum registro encontrado"}
                </span>
              </div>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

export function Pagination({
  page,
  perPage,
  total,
  onPage,
}: {
  page: number;
  perPage: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
      <span>
        Página{" "}
        <span className="font-mono font-semibold text-foreground">{page}</span>{" "}
        de{" "}
        <span className="font-mono font-semibold text-foreground">{pages}</span>
        <span className="mx-1.5 text-muted-foreground/60">•</span>
        <span className="font-mono font-semibold text-foreground">
          {total}
        </span>{" "}
        registro(s)
      </span>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Anterior
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Próxima
        </Button>
      </div>
    </div>
  );
}

export function FormField({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  const generatedId = useId();
  const errorId = `${generatedId}-error`;

  let content = children;
  if (isValidElement(children)) {
    const element = children as ReactElement<{
      id?: string;
      "aria-invalid"?: boolean;
      "aria-describedby"?: string;
    }>;
    content = cloneElement(element, {
      id: element.props.id ?? generatedId,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? errorId : undefined,
    });
  }

  return (
    <div>
      <Label className="mb-1.5" htmlFor={generatedId}>
        {label}
      </Label>
      {content}
      {hint && !error && (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function ErrorBanner({ message }: { message?: string | null }) {
  if (!message) {
    return null;
  }

  return (
    <Alert variant="destructive" className="mb-4">
      <CircleAlert />
      <AlertDescription className="text-destructive">
        {message}
      </AlertDescription>
    </Alert>
  );
}

export function SearchBar({
  value,
  onChange,
  onSubmit,
  placeholder = "Buscar…",
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
}) {
  return (
    <form
      className="flex w-full max-w-md gap-2"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          className="pl-9"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      <Button type="submit" variant="outline">
        Buscar
      </Button>
    </form>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Card className="items-center gap-2 px-6 py-12 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Inbox className="size-5" aria-hidden />
      </span>
      <p className="text-base font-semibold text-foreground">{title}</p>
      {description && (
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      )}
      {action}
    </Card>
  );
}

export type StatusTone =
  "success" | "warning" | "critical" | "info" | "neutral";

export function StatusBadge({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Badge variant={tone} className={className}>
      {children}
    </Badge>
  );
}

/** Barra de filtros e ações acima de tabelas e listagens. */
export function Toolbar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-3 flex flex-wrap items-center justify-between gap-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Valor técnico (placa, documento, data, métrica) sempre em fonte monoespaçada. */
export function MonoValue({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("font-mono tabular-nums", className)}>{children}</span>
  );
}

/** Caixa de seleção com rótulo e descrição opcional, no padrão do design system. */
export function CheckboxField({
  label,
  checked,
  onCheckedChange,
  description,
  disabled,
  className,
}: {
  label: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();

  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="mt-0.5"
      />
      <div className="grid gap-0.5">
        <Label
          htmlFor={id}
          className={cn(
            "text-sm font-medium text-foreground",
            disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer",
          )}
        >
          {label}
        </Label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
}

/** Interruptor booleano com rótulo, para preferências e situações de registro. */
export function SwitchField({
  label,
  checked,
  onCheckedChange,
  description,
  disabled,
  className,
}: {
  label: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();

  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="grid gap-0.5">
        <Label
          htmlFor={id}
          className={cn(
            "text-sm font-medium text-foreground",
            disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer",
          )}
        >
          {label}
        </Label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Diálogo de confirmação acessível, no lugar de `window.confirm`.
 * Envolve a aplicação e expõe a função `useConfirm`.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<{
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (options) =>
      new Promise<boolean>((resolve) => {
        setRequest({ options, resolve });
      }),
    [],
  );

  const settle = (value: boolean) => {
    const current = request;
    setRequest(null);
    current?.resolve(value);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={request !== null}
        onOpenChange={(open) => {
          if (!open) {
            settle(false);
          }
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{request?.options.title}</DialogTitle>
            <DialogDescription>
              {request?.options.description ??
                "Confirme a ação para continuar."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => settle(false)}
            >
              {request?.options.cancelLabel ?? "Cancelar"}
            </Button>
            <Button
              type="button"
              variant={request?.options.destructive ? "destructive" : "default"}
              onClick={() => settle(true)}
            >
              {request?.options.confirmLabel ?? "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error("useConfirm deve ser usado dentro de ConfirmProvider");
  }

  return confirm;
}
