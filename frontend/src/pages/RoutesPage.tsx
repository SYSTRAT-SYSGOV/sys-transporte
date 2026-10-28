import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/api/client";
import {
  AcademicYear,
  Company,
  Driver,
  Route,
  ROUTE_TYPE_LABELS,
  RoutePayload,
  School,
  SHIFT_LABELS,
  Vehicle,
} from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { OccupancyBadge } from "@/components/OccupancyBadge";
import {
  Button,
  Card,
  CheckboxField,
  DataTable,
  ErrorBanner,
  FormField,
  Input,
  Modal,
  NativeSelect,
  PageHeader,
  Pagination,
  SearchBar,
  Textarea,
  useConfirm,
} from "@sysgov/ui";
import { errorMessage, fieldError, useSearch } from "@/lib/errors";
import { formatNumber, timeOrNull, toTimeInput } from "@/lib/format";
import { useArray, useOptions, usePagedList } from "@/lib/queries";

const empty: RoutePayload = {
  name: "",
  school_id: "",
  academic_year_id: "",
  company_id: null,
  vehicle_id: null,
  driver_id: null,
  shift: "morning",
  route_type: "rural",
  km_paved: 0,
  km_unpaved: 0,
  departure_time: null,
  arrival_time: null,
  return_departure_time: null,
  is_outsourced: false,
  is_active: true,
  notes: null,
};

export default function RoutesPage() {
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const search = useSearch();
  const [yearFilter, setYearFilter] = useState("");
  const [editing, setEditing] = useState<Route | "new" | null>(null);
  const [form, setForm] = useState<RoutePayload>(empty);

  const list = usePagedList<Route>("routes", "/transport/routes", {
    page,
    per_page: 20,
    search: search.committed,
    academic_year_id: yearFilter,
  });
  const years = useArray<AcademicYear>("years", "/registry/academic-years");
  const schools = useOptions<School>("schools", "/registry/schools");
  const companies = useOptions<Company>("companies", "/transport/companies");
  const vehicles = useOptions<Vehicle>("vehicles", "/transport/vehicles");
  const drivers = useOptions<Driver>("drivers", "/transport/drivers");

  const save = useMutation({
    mutationFn: async () => {
      const body = JSON.stringify({
        ...form,
        departure_time: timeOrNull(form.departure_time ?? ""),
        arrival_time: timeOrNull(form.arrival_time ?? ""),
        return_departure_time: timeOrNull(form.return_departure_time ?? ""),
      });
      if (editing === "new") {
        return api<Route>("/transport/routes", { method: "POST", body });
      }
      return api<Route>(`/transport/routes/${(editing as Route).id}`, {
        method: "PUT",
        body,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routes"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setEditing(null);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      api(`/transport/routes/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["routes"] }),
  });

  const canManage = hasPermission("transport.route.manage");

  const openNew = () => {
    setForm({
      ...empty,
      school_id: schools.data?.items[0]?.id ?? "",
      academic_year_id: years.data?.find((year) => year.is_active)?.id ?? "",
    });
    setEditing("new");
  };

  const openEdit = (route: Route) => {
    setForm({
      name: route.name,
      school_id: route.school_id,
      academic_year_id: route.academic_year_id,
      company_id: route.company_id,
      vehicle_id: route.vehicle_id,
      driver_id: route.driver_id,
      shift: route.shift,
      route_type: route.route_type,
      km_paved: route.km_paved,
      km_unpaved: route.km_unpaved,
      departure_time: route.departure_time,
      arrival_time: route.arrival_time,
      return_departure_time: route.return_departure_time,
      is_outsourced: route.is_outsourced,
      is_active: route.is_active,
      notes: route.notes,
    });
    setEditing(route);
  };

  return (
    <div>
      <PageHeader
        title="Rotas"
        description="Itinerário, veículo, motorista e lotação de cada rota."
        actions={
          canManage && (
            <Button type="button" onClick={openNew}>
              Nova rota
            </Button>
          )
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchBar
          value={search.input}
          onChange={search.setInput}
          onSubmit={search.submit}
        />
        <NativeSelect
          className="max-w-[220px]"
          value={yearFilter}
          onChange={(event) => {
            setPage(1);
            setYearFilter(event.target.value);
          }}
        >
          <option value="">Todos os anos</option>
          {years.data?.map((year) => (
            <option key={year.id} value={year.id}>
              {year.year}
            </option>
          ))}
        </NativeSelect>
      </div>

      <Card className="overflow-hidden">
        <DataTable
          loading={list.isLoading}
          rows={list.data?.items}
          keyOf={(row) => row.id}
          empty="Nenhuma rota cadastrada"
          columns={[
            {
              header: "Rota",
              render: (row) => (
                <div>
                  <Link to={`/routes/${row.id}`} className="link">
                    {row.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {row.school_name}
                  </p>
                </div>
              ),
            },
            {
              header: "Turno / tipo",
              render: (row) => (
                <div>
                  <p className="text-sm text-foreground">
                    {SHIFT_LABELS[row.shift] ?? row.shift}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ROUTE_TYPE_LABELS[row.route_type] ?? row.route_type}
                  </p>
                </div>
              ),
            },
            {
              header: "Veículo / motorista",
              render: (row) => (
                <div className="text-xs text-gov-text-secondary">
                  <p>{row.vehicle_description ?? "Sem veículo"}</p>
                  <p className="text-muted-foreground">
                    {row.driver_name ?? "Sem motorista"}
                  </p>
                </div>
              ),
            },
            {
              header: "Itinerário",
              render: (row) => (
                <div className="text-xs">
                  <p className="text-muted-foreground">
                    {row.stops_count} parada(s)
                  </p>
                  <p
                    className={
                      row.itinerary_valid
                        ? "text-success-strong"
                        : "text-warning-strong"
                    }
                  >
                    {row.itinerary_valid ? "Válido" : "Incompleto"}
                  </p>
                </div>
              ),
            },
            {
              header: "Lotação",
              render: (row) => (
                <div>
                  <OccupancyBadge
                    allocated={row.allocated_students}
                    capacity={row.capacity}
                    percentage={row.occupancy_percentage}
                  />
                  <p className="mt-1 font-mono text-[11px] text-gov-text-muted tabular-nums">
                    {formatNumber(row.total_km)} km
                  </p>
                </div>
              ),
            },
            {
              header: "",
              className: "text-right",
              render: (row) => (
                <div className="flex justify-end gap-1">
                  <Button asChild variant="ghost" size="sm">
                    <Link to={`/routes/${row.id}`}>Alunos da rota</Link>
                  </Button>
                  {canManage && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => openEdit(row)}
                      >
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="destructiveOutline"
                        onClick={async () => {
                          const ok = await confirm({
                            title: `Inativar a rota "${row.name}"?`,
                            description:
                              "A rota sai das listagens padrão e mantém o histórico de itinerário e alocações.",
                            confirmLabel: "Inativar",
                            destructive: true,
                          });
                          if (ok) {
                            remove.mutate(row.id);
                          }
                        }}
                      >
                        Inativar
                      </Button>
                    </>
                  )}
                </div>
              ),
            },
          ]}
        />
        {list.data && (
          <Pagination
            page={list.data.page}
            perPage={list.data.per_page}
            total={list.data.total}
            onPage={setPage}
          />
        )}
      </Card>

      {editing && (
        <Modal
          title={editing === "new" ? "Nova rota" : "Editar rota"}
          onClose={() => setEditing(null)}
          wide
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"

                onClick={() => save.mutate()}
                disabled={save.isPending}
              >
                {save.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </>
          }
        >
          <ErrorBanner message={errorMessage(save.error)} />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <FormField
                label="Nome da rota"
                error={fieldError(save.error, "name")}
              >
                <Input
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                />
              </FormField>
            </div>
            <FormField label="Turno">
              <NativeSelect
                value={form.shift}
                onChange={(event) =>
                  setForm({ ...form, shift: event.target.value })
                }
              >
                {Object.entries(SHIFT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField
              label="Escola"
              error={fieldError(save.error, "school_id")}
            >
              <NativeSelect
                value={form.school_id}
                onChange={(event) =>
                  setForm({ ...form, school_id: event.target.value })
                }
              >
                <option value="">Selecione</option>
                {schools.data?.items.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField
              label="Ano letivo"
              error={fieldError(save.error, "academic_year_id")}
            >
              <NativeSelect
                value={form.academic_year_id}
                onChange={(event) =>
                  setForm({ ...form, academic_year_id: event.target.value })
                }
              >
                <option value="">Selecione</option>
                {years.data?.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.year}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Tipo de rota">
              <NativeSelect
                value={form.route_type}
                onChange={(event) =>
                  setForm({ ...form, route_type: event.target.value })
                }
              >
                {Object.entries(ROUTE_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Empresa">
              <NativeSelect
                value={form.company_id ?? ""}
                onChange={(event) =>
                  setForm({ ...form, company_id: event.target.value || null })
                }
              >
                <option value="">Sem vínculo</option>
                {companies.data?.items.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.legal_name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Veículo">
              <NativeSelect
                value={form.vehicle_id ?? ""}
                onChange={(event) =>
                  setForm({ ...form, vehicle_id: event.target.value || null })
                }
              >
                <option value="">Sem veículo</option>
                {vehicles.data?.items.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.description} — {vehicle.plate}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Motorista">
              <NativeSelect
                value={form.driver_id ?? ""}
                onChange={(event) =>
                  setForm({ ...form, driver_id: event.target.value || null })
                }
              >
                <option value="">Sem motorista</option>
                {drivers.data?.items.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.full_name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField
              label="Km pavimentado"
              error={fieldError(save.error, "km_paved")}
            >
              <Input
                inputMode="decimal"
                value={form.km_paved}
                onChange={(event) =>
                  setForm({
                    ...form,
                    km_paved: Number(event.target.value || 0),
                  })
                }
              />
            </FormField>
            <FormField
              label="Km não pavimentado"
              error={fieldError(save.error, "km_unpaved")}
            >
              <Input
                inputMode="decimal"
                value={form.km_unpaved}
                onChange={(event) =>
                  setForm({
                    ...form,
                    km_unpaved: Number(event.target.value || 0),
                  })
                }
              />
            </FormField>
            <FormField label="Saída">
              <Input
                type="time"

                value={toTimeInput(form.departure_time)}
                onChange={(event) =>
                  setForm({
                    ...form,
                    departure_time: event.target.value || null,
                  })
                }
              />
            </FormField>
            <FormField label="Chegada">
              <Input
                type="time"

                value={toTimeInput(form.arrival_time)}
                onChange={(event) =>
                  setForm({ ...form, arrival_time: event.target.value || null })
                }
              />
            </FormField>
            <FormField label="Retorno">
              <Input
                type="time"

                value={toTimeInput(form.return_departure_time)}
                onChange={(event) =>
                  setForm({
                    ...form,
                    return_departure_time: event.target.value || null,
                  })
                }
              />
            </FormField>
            <div className="sm:col-span-3">
              <FormField label="Observações">
                <Textarea
                  rows={2}
                  value={form.notes ?? ""}
                  onChange={(event) =>
                    setForm({ ...form, notes: event.target.value || null })
                  }
                />
              </FormField>
            </div>
            <CheckboxField
              label="Rota terceirizada"
              checked={form.is_outsourced}
              onCheckedChange={(is_outsourced) =>
                setForm({ ...form, is_outsourced })
              }
            />
            <CheckboxField
              label="Rota ativa"
              checked={form.is_active}
              onCheckedChange={(is_active) => setForm({ ...form, is_active })}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
