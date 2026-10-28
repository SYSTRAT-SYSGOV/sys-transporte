import { Suspense, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BookOpenCheck,
  Building2,
  Bus,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  IdCard,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Palette,
  Route as RouteIcon,
  School,
  ScrollText,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useAuth } from "@/auth/AuthContext";
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Sheet,
  SheetContent,
  SheetTitle,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
} from "@sysgov/ui";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  permission: string;
  shortcut: string;
  end?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const groups: NavGroup[] = [
  {
    title: "Operação",
    items: [
      {
        to: "/",
        label: "Painel",
        icon: LayoutDashboard,
        permission: "transport.dashboard.read",
        shortcut: "P",
        end: true,
      },
      {
        to: "/routes",
        label: "Rotas",
        icon: RouteIcon,
        permission: "transport.route.read",
        shortcut: "R",
      },
      {
        to: "/census",
        label: "Censo escolar",
        icon: ClipboardList,
        permission: "transport.census.read",
        shortcut: "C",
      },
    ],
  },
  {
    title: "Cadastros",
    items: [
      {
        to: "/schools",
        label: "Escolas",
        icon: School,
        permission: "registry.school.read",
        shortcut: "E",
      },
      {
        to: "/students",
        label: "Alunos",
        icon: GraduationCap,
        permission: "registry.student.read",
        shortcut: "A",
      },
      {
        to: "/enrollments",
        label: "Matrículas",
        icon: BookOpenCheck,
        permission: "registry.enrollment.read",
        shortcut: "M",
      },
    ],
  },
  {
    title: "Frota",
    items: [
      {
        to: "/companies",
        label: "Empresas",
        icon: Building2,
        permission: "transport.company.read",
        shortcut: "F",
      },
      {
        to: "/drivers",
        label: "Motoristas",
        icon: IdCard,
        permission: "transport.driver.read",
        shortcut: "D",
      },
      {
        to: "/vehicles",
        label: "Veículos",
        icon: Bus,
        permission: "transport.vehicle.read",
        shortcut: "V",
      },
      {
        to: "/stops",
        label: "Paradas",
        icon: MapPin,
        permission: "transport.stop.read",
        shortcut: "S",
      },
    ],
  },
  {
    title: "Administração",
    items: [
      {
        to: "/users",
        label: "Usuários",
        icon: Users,
        permission: "identity.user.manage",
        shortcut: "U",
      },
      {
        to: "/roles",
        label: "Papéis",
        icon: ShieldCheck,
        permission: "identity.role.manage",
        shortcut: "O",
      },
      {
        to: "/audit",
        label: "Auditoria",
        icon: ScrollText,
        permission: "identity.audit.read",
        shortcut: "L",
      },
      {
        to: "/design-system",
        label: "Design system",
        icon: Palette,
        permission: "identity.user.manage",
        shortcut: "G",
      },
    ],
  },
];

const shortcuts = Object.fromEntries(
  groups.flatMap((group) =>
    group.items.map((item) => [item.shortcut.toLowerCase(), item.to]),
  ),
);

function initials(name?: string) {
  if (!name) {
    return "US";
  }

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, hasPermission } = useAuth();

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border bg-gov-page px-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-gov-blue-dark text-white shadow-sm">
          <Bus className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold tracking-[0.18em] uppercase">
            <span className="text-gov-blue">SYS</span>
            <span className="text-success">TRAT</span>
          </p>
          <p className="truncate text-sm font-bold text-gov-blue-dark">
            Transporte Escolar
          </p>
        </div>
      </div>

      <nav
        aria-label="Menu principal"
        className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-5"
      >
        {groups.map((group) => {
          const items = group.items.filter((item) =>
            hasPermission(item.permission),
          );
          if (items.length === 0) {
            return null;
          }

          return (
            <div key={group.title}>
              <p className="mb-2 border-b border-gov-primary-border px-3 pb-2 text-[10px] font-bold tracking-[0.14em] text-gov-blue-dark uppercase">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    title={`Alt+${item.shortcut}`}
                    className={({ isActive }) =>
                      cn(
                        "group flex items-center gap-3 rounded-md border-l-[3px] px-3 py-2 text-sm font-bold transition-colors",
                        isActive
                          ? "border-gov-blue-dark bg-sidebar-accent text-gov-blue-dark"
                          : "border-transparent text-sidebar-foreground hover:bg-gov-primary-light/60 hover:text-gov-blue-dark",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon
                          className={cn(
                            "size-4 shrink-0",
                            isActive
                              ? "text-gov-blue-dark"
                              : "text-gov-text-secondary group-hover:text-gov-blue-dark",
                          )}
                          aria-hidden
                        />
                        <span className="truncate">{item.label}</span>
                        <kbd
                          aria-hidden="true"
                          className={cn(
                            "ml-auto rounded border px-1.5 py-0.5 font-mono text-[10px] leading-none",
                            isActive
                              ? "border-gov-primary-border bg-card text-gov-blue-dark"
                              : "border-sidebar-border bg-muted text-gov-text-secondary group-hover:text-gov-blue-dark",
                          )}
                        >
                          {item.shortcut}
                        </kbd>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border bg-gov-page p-3">
        <div className="flex items-center gap-3 rounded-lg border border-sidebar-border bg-card px-3 py-2.5">
          <Avatar className="size-8">
            <AvatarFallback className="bg-gov-blue-dark text-xs font-bold text-white">
              {initials(user?.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold text-gov-blue-dark">
              {user?.full_name}
            </p>
            <p className="truncate text-[11px] text-gov-text-secondary">
              {user?.email}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.repeat) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (
        target?.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }

      const to = shortcuts[event.key.toLowerCase()];
      if (!to) {
        return;
      }

      event.preventDefault();
      setMobileOpen(false);
      navigate(to);
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const current =
    groups
      .flatMap((group) => group.items)
      .find((item) =>
        item.end
          ? location.pathname === item.to
          : location.pathname.startsWith(item.to),
      )?.label ?? "Painel";

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[272px] border-r border-sidebar-border bg-sidebar shadow-[4px_0_16px_rgba(0,0,0,0.04)] lg:block">
        <SidebarContent />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[290px] p-0">
          <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-col lg:pl-[272px]">
        <header className="sticky top-0 z-30 shrink-0 border-b border-border bg-card/95 shadow-sm backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 md:px-6 lg:px-8">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Abrir menu"
              onClick={() => setMobileOpen(true)}
            >
              <Menu />
            </Button>

            <div className="flex min-w-0 items-center gap-3">
              <span className="hidden text-sm font-extrabold tracking-tight sm:inline">
                <span className="text-gov-blue">SYS</span>
                <span className="text-success">TRAT</span>
              </span>
              <span
                className="hidden h-4 w-px bg-border sm:inline"
                aria-hidden
              />
              <div className="min-w-0">
                <p className="text-[10px] font-bold tracking-[0.14em] text-gov-text-muted uppercase">
                  Transporte escolar
                </p>
                <p className="truncate text-sm font-bold text-gov-blue-dark">
                  {current}
                </p>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <Badge
                variant="outline"
                className="hidden h-8 gap-1.5 border-gov-border bg-gov-page px-2.5 text-gov-text-secondary sm:inline-flex"
              >
                <CalendarDays
                  className="size-3.5 text-gov-text-muted"
                  aria-hidden
                />
                Exercício{" "}
                <span className="font-mono">{new Date().getFullYear()}</span>
              </Badge>

              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="hidden items-center gap-1.5 rounded-full border border-success-border bg-success-surface px-2.5 py-1 text-[11px] font-semibold text-success-strong md:inline-flex">
                    <span
                      className="size-1.5 rounded-full bg-success"
                      aria-hidden
                    />
                    Online
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  API e banco de dados disponíveis
                </TooltipContent>
              </Tooltip>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-10 gap-2 px-1.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {initials(user?.full_name)}
                    </span>
                    <span className="hidden text-left md:block">
                      <span className="block max-w-[150px] truncate text-[13px] font-semibold text-foreground">
                        {user?.full_name}
                      </span>
                      <span className="block max-w-[150px] truncate text-[11px] font-normal text-muted-foreground">
                        {user?.email}
                      </span>
                    </span>
                    <ChevronDown
                      className="size-3.5 text-muted-foreground"
                      aria-hidden
                    />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel className="py-2">
                    <span className="block truncate text-[13px] font-semibold text-foreground">
                      {user?.full_name}
                    </span>
                    <span className="block truncate text-[11px] font-normal text-muted-foreground">
                      {user?.email}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => void handleLogout()}
                  >
                    <LogOut />
                    Sair do sistema
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="border-t border-border/70 bg-muted/40">
            <div className="mx-auto flex w-full max-w-[1600px] items-center px-4 py-2 md:px-6 lg:px-8">
              <nav
                aria-label="Breadcrumb"
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <span className="font-bold text-primary">SYSGOV</span>
                <ChevronRight className="size-3.5" aria-hidden />
                <span className="font-semibold text-foreground">{current}</span>
              </nav>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 md:px-6 lg:px-8">
          <Suspense
            fallback={
              <div className="space-y-4">
                <Skeleton className="h-9 w-64" />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-24 w-full" />
                  ))}
                </div>
                <Skeleton className="h-64 w-full" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>

        <footer className="mx-auto w-full max-w-[1600px] px-4 pb-6 text-[11px] text-gov-text-muted md:px-6 lg:px-8">
          SYSTRAT · Transporte Escolar · Operações registradas na trilha de
          auditoria
        </footer>
      </div>
    </div>
  );
}
