import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bus,
  GraduationCap,
  IdCard,
  Route as RouteIcon,
  School,
  TriangleAlert,
  Users,
} from "lucide-react";

import { api } from "@/api/client";
import type { DashboardSummary } from "@/api/types";
import { AlertList } from "@/components/AlertList";
import { OccupancyBadge } from "@/components/OccupancyBadge";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  ErrorBanner,
  PageHeader,
  SectionCard,
  Skeleton,
  StatCard,
} from "@sysgov/ui";
import { formatNumber } from "@/lib/format";

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: () => api<DashboardSummary>("/dashboard/summary"),
  });

  const counts = data?.counts;
  const alerts = data?.alerts ?? [];
  const criticalAlerts = alerts.filter(
    (alert) => alert.severity === "critical",
  ).length;
  const routesInAttention =
    data?.occupancy.filter((item) => (item.occupancy_percentage ?? 0) >= 80)
      .length ?? 0;

  return (
    <div>
      <PageHeader
        title="Painel operacional"
        description="Visão consolidada da frota, lotação e conformidade documental do transporte escolar."
        actions={
          <Button asChild variant="outline">
            <Link to="/census">
              Censo escolar
              <ArrowRight />
            </Link>
          </Button>
        }
      />

      <ErrorBanner
        message={error ? "Não foi possível carregar o painel." : null}
      />

      {(criticalAlerts > 0 || routesInAttention > 0) && (
        <Alert
          variant={criticalAlerts > 0 ? "destructive" : "warning"}
          className="mb-5"
        >
          <TriangleAlert />
          <AlertTitle>Atenção operacional</AlertTitle>
          <AlertDescription>
            {criticalAlerts > 0 && (
              <p>
                <span className="font-mono font-semibold">
                  {criticalAlerts}
                </span>{" "}
                alerta(s) crítico(s) de conformidade documental.
              </p>
            )}
            {routesInAttention > 0 && (
              <p>
                <span className="font-mono font-semibold">
                  {routesInAttention}
                </span>{" "}
                rota(s) com lotação igual ou superior a 80%.
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          label="Escolas"
          value={counts?.schools ?? "—"}
          hint="Unidades atendidas"
          icon={<School />}
        />
        <StatCard
          label="Estudantes"
          value={counts?.students ?? "—"}
          hint="Matrículas ativas"
          icon={<GraduationCap />}
          accent="info"
        />
        <StatCard
          label="Rotas ativas"
          value={counts?.routes ?? "—"}
          hint="Itinerários em operação"
          icon={<RouteIcon />}
          accent="primary"
        />
        <StatCard
          label="Veículos"
          value={counts?.vehicles ?? "—"}
          hint="Frota cadastrada"
          icon={<Bus />}
          accent="info"
        />
        <StatCard
          label="Motoristas"
          value={counts?.drivers ?? "—"}
          hint="Condutores vinculados"
          icon={<IdCard />}
          accent="neutral"
        />
        <StatCard
          label="Alocações"
          value={counts?.allocations ?? "—"}
          hint="Estudantes transportados"
          icon={<Users />}
          accent="warning"
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <SectionCard
          title="Lotação por rota"
          description="Acima de 80% exige atenção; acima de 100% é bloqueado."
          action={
            <Button asChild variant="ghost" size="sm">
              <Link to="/routes">
                Ver rotas
                <ArrowRight />
              </Link>
            </Button>
          }
        >
          <div className="divide-y divide-border/70">
            {isLoading && (
              <div className="space-y-3 p-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-10 w-full" />
                ))}
              </div>
            )}
            {!isLoading && (data?.occupancy.length ?? 0) === 0 && (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                Nenhuma rota ativa cadastrada.
              </p>
            )}
            {data?.occupancy.map((item) => (
              <div
                key={item.route_id}
                className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-muted/60"
              >
                <div className="min-w-0">
                  <Link
                    to={`/routes/${item.route_id}`}
                    className="link block truncate text-sm"
                  >
                    {item.name}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.school_name}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <OccupancyBadge
                    allocated={item.allocated_students}
                    capacity={item.capacity}
                    percentage={item.occupancy_percentage}
                  />
                  <p className="mt-1 font-mono text-[11px] text-gov-text-muted tabular-nums">
                    {formatNumber(item.occupancy_percentage)}% da capacidade
                  </p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Alertas de conformidade"
          description="CNH, curso, toxicológico e vistoria com vencimento em até 30 dias."
          action={
            <Button asChild variant="ghost" size="sm">
              <Link to="/drivers">
                Ver motoristas
                <ArrowRight />
              </Link>
            </Button>
          }
        >
          <div className="px-5">
            {isLoading ? (
              <div className="space-y-3 py-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <AlertList alerts={alerts} limit={8} />
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
