import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "@/api/client";
import {
  Allocation,
  AllocationPayload,
  JURISDICTION_LABELS,
  Page,
  ROUTE_TYPE_LABELS,
  RouteDetail,
  RouteStop,
  SHIFT_LABELS,
  Stop,
  Student,
} from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { MapView } from "@/components/MapView";
import { OccupancyBadge } from "@/components/OccupancyBadge";
import {
  Badge,
  Button,
  Card,
  CheckboxField,
  DataTable,
  EmptyState,
  ErrorBanner,
  FormField,
  Input,
  Modal,
  NativeSelect,
  PageHeader,
  Skeleton,
  StatCard,
  Textarea,
  useConfirm,
} from "@sysgov/ui";
import { errorMessage } from "@/lib/errors";
import { formatDate, timeOrNull, toTimeInput } from "@/lib/format";
import { useOptions } from "@/lib/queries";

interface ItineraryItem {
  stop_id: string;
  pickup: string;
  dropoff: string;
}

interface AllocationForm {
  student_id: string;
  stop_id: string;
  uses_rural_transport: boolean;
  public_transport_jurisdiction: string;
  special_needs_transport: boolean;
  special_needs_notes: string;
  override_justification: string;
}

const emptyAllocation: AllocationForm = {
  student_id: "",
  stop_id: "",
  uses_rural_transport: false,
  public_transport_jurisdiction: "",
  special_needs_transport: false,
  special_needs_notes: "",
  override_justification: "",
};

export default function RouteEditorPage() {
  const { id = "" } = useParams();
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [itinerary, setItinerary] = useState<ItineraryItem[]>([]);
  const [newStop, setNewStop] = useState("");
  const [showClosed, setShowClosed] = useState(false);
  const [allocating, setAllocating] = useState(false);
  const [allocationForm, setAllocationForm] =
    useState<AllocationForm>(emptyAllocation);

  const routeQuery = useQuery({
    queryKey: ["routes", "detail", id],
    queryFn: () => api<RouteDetail>(`/transport/routes/${id}`),
    enabled: Boolean(id),
  });

  const allocations = useQuery({
    queryKey: ["allocations", id, showClosed],
    queryFn: () =>
      api<Allocation[]>(
        `/transport/routes/${id}/students${showClosed ? "?include_closed=true" : ""}`,
      ),
    enabled: Boolean(id),
  });

  const stops = useOptions<Stop>("stops", "/transport/stops");
  const routeStops = useQuery({
    queryKey: ["route-stops", id],
    queryFn: () =>
      api<Page<Stop>>(`/transport/stops?route_id=${id}&per_page=100`),
    enabled: Boolean(id),
  });
  const students = useOptions<Student>("students", "/registry/students");

  const route = routeQuery.data;
  const canManageRoute = hasPermission("transport.route.manage");
  const canManageAllocation = hasPermission("transport.allocation.manage");
  const canOverride = hasPermission("transport.allocation.override_capacity");

  useEffect(() => {
    if (route) {
      setItinerary(
        route.stops.map((stop) => ({
          stop_id: stop.stop_id,
          pickup: toTimeInput(stop.estimated_pickup_time),
          dropoff: toTimeInput(stop.estimated_dropoff_time),
        })),
      );
    }
  }, [route]);

  const committedStops = useMemo(() => {
    const byId = new Map<string, RouteStop>();
    route?.stops.forEach((stop) => byId.set(stop.stop_id, stop));
    return itinerary.map((item, index) => {
      const source = byId.get(item.stop_id);
      const option = stops.data?.items.find((stop) => stop.id === item.stop_id);
      return {
        id: `${item.stop_id}-${index}`,
        name: source?.name ?? option?.name ?? "Parada",
        latitude: source?.latitude ?? option?.latitude ?? null,
        longitude: source?.longitude ?? option?.longitude ?? null,
        sequence_order: index + 1,
      };
    });
  }, [route, itinerary, stops.data]);

  const saveItinerary = useMutation({
    mutationFn: () =>
      api(`/transport/routes/${id}/stops`, {
        method: "PUT",
        body: JSON.stringify({
          stops: itinerary.map((item) => ({
            stop_id: item.stop_id,
            estimated_pickup_time: timeOrNull(item.pickup),
            estimated_dropoff_time: timeOrNull(item.dropoff),
          })),
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routes"] });
      queryClient.invalidateQueries({ queryKey: ["route-stops", id] });
    },
  });

  const createAllocation = useMutation({
    mutationFn: () => {
      const payload: AllocationPayload = {
        student_id: allocationForm.student_id,
        stop_id: allocationForm.stop_id || null,
        shift: null,
        uses_rural_transport: allocationForm.uses_rural_transport,
        public_transport_jurisdiction:
          allocationForm.public_transport_jurisdiction
            ? Number(allocationForm.public_transport_jurisdiction)
            : null,
        special_needs_transport: allocationForm.special_needs_transport,
        special_needs_notes: allocationForm.special_needs_notes || null,
        start_date: null,
        override_justification: allocationForm.override_justification || null,
      };
      return api<Allocation>(`/transport/routes/${id}/students`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allocations", id] });
      queryClient.invalidateQueries({ queryKey: ["routes"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setAllocating(false);
    },
  });

  const closeAllocation = useMutation({
    mutationFn: (allocationId: string) =>
      api(`/transport/routes/${id}/students/${allocationId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allocations", id] });
      queryClient.invalidateQueries({ queryKey: ["routes"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  if (routeQuery.isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  if (!route) {
    return (
      <EmptyState
        title="Rota não encontrada"
        description="A rota pode ter sido removida ou você não possui acesso."
        action={
          <Button asChild variant="outline">
            <Link to="/routes">Voltar para rotas</Link>
          </Button>
        }
      />
    );
  }

  const capacity = route.capacity ?? null;
  const allocatedCount =
    allocations.data?.filter((item) => !item.end_date).length ?? 0;
  const atCapacity = capacity !== null && allocatedCount >= capacity;
  const validStopIds = new Set(itinerary.map((item) => item.stop_id));

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= itinerary.length) {
      return;
    }
    setItinerary((current) => {
      const copy = [...current];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  };

  const addStop = () => {
    if (!newStop || validStopIds.has(newStop)) {
      return;
    }
    setItinerary((current) => [
      ...current,
      { stop_id: newStop, pickup: "", dropoff: "" },
    ]);
    setNewStop("");
  };

  return (
    <div>
      <PageHeader
        title={route.name}
        description={`${route.school_name} · ${SHIFT_LABELS[route.shift] ?? route.shift} · ${
          ROUTE_TYPE_LABELS[route.route_type] ?? route.route_type
        }`}
        actions={
          <Button asChild variant="outline">
            <Link to="/routes">Voltar</Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Lotação"
          value={
            <OccupancyBadge
              allocated={allocatedCount}
              capacity={capacity}
              percentage={route.occupancy_percentage}
            />
          }
          hint={`Capacidade do veículo: ${capacity ?? "não definida"}`}
        />
        <StatCard
          label="Paradas"
          value={route.stops_count}
          hint={`${route.total_km} km totais`}
        />
        <StatCard
          label="Itinerário"
          value={
            route.itinerary_valid ? (
              <Badge variant="success">Válido</Badge>
            ) : (
              <Badge variant="warning">Incompleto</Badge>
            )
          }
          hint="Ao menos duas paradas com horários de embarque e desembarque"
        />
        <StatCard
          label="Veículo"
          value={route.vehicle_plate ?? "—"}
          hint={route.driver_name ?? "Sem motorista vinculado"}
        />
      </div>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Mapa do itinerário
          </h2>
          <MapView stops={committedStops} height={320} />
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              Itinerário
            </h2>
            {canManageRoute && (
              <Button
                type="button"

                onClick={() => saveItinerary.mutate()}
                disabled={saveItinerary.isPending}
              >
                {saveItinerary.isPending ? "Salvando…" : "Salvar itinerário"}
              </Button>
            )}
          </div>
          <ErrorBanner message={errorMessage(saveItinerary.error)} />
          {itinerary.length === 0 && (
            <p className="rounded-lg bg-muted/50 px-3 py-4 text-sm text-muted-foreground">
              Nenhuma parada adicionada. Inclua ao menos duas para validar o
              itinerário.
            </p>
          )}
          <ol className="space-y-2">
            {itinerary.map((item, index) => {
              const option = stops.data?.items.find(
                (stop) => stop.id === item.stop_id,
              );
              return (
                <li
                  key={`${item.stop_id}-${index}`}
                  className="rounded-lg border border-border p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {index + 1}. {option?.name ?? item.stop_id}
                    </span>
                    {canManageRoute && (
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => move(index, -1)}
                          disabled={index === 0}
                          aria-label="Subir parada"
                        >
                          ↑
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => move(index, 1)}
                          disabled={index === itinerary.length - 1}
                          aria-label="Descer parada"
                        >
                          ↓
                        </Button>
                        <Button
                          type="button"
                          variant="destructiveOutline"
                          onClick={() =>
                            setItinerary((current) =>
                              current.filter(
                                (_, position) => position !== index,
                              ),
                            )
                          }
                        >
                          Remover
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <FormField label="Embarque">
                      <Input
                        type="time"

                        value={item.pickup}
                        disabled={!canManageRoute}
                        onChange={(event) =>
                          setItinerary((current) =>
                            current.map((entry, position) =>
                              position === index
                                ? { ...entry, pickup: event.target.value }
                                : entry,
                            ),
                          )
                        }
                      />
                    </FormField>
                    <FormField label="Desembarque">
                      <Input
                        type="time"

                        value={item.dropoff}
                        disabled={!canManageRoute}
                        onChange={(event) =>
                          setItinerary((current) =>
                            current.map((entry, position) =>
                              position === index
                                ? { ...entry, dropoff: event.target.value }
                                : entry,
                            ),
                          )
                        }
                      />
                    </FormField>
                  </div>
                </li>
              );
            })}
          </ol>

          {canManageRoute && (
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div className="min-w-[220px] flex-1">
                <FormField label="Adicionar parada">
                  <NativeSelect
                    value={newStop}
                    onChange={(event) => setNewStop(event.target.value)}
                  >
                    <option value="">Selecione um ponto</option>
                    {stops.data?.items
                      .filter((stop) => !validStopIds.has(stop.id))
                      .map((stop) => (
                        <option key={stop.id} value={stop.id}>
                          {stop.name}
                        </option>
                      ))}
                  </NativeSelect>
                </FormField>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={addStop}
                disabled={!newStop}
              >
                Adicionar
              </Button>
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-5 overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Alunos alocados
            </h2>
            <p className="text-xs text-muted-foreground">
              Superlotação é bloqueada; a exceção exige permissão específica e
              justificativa.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <CheckboxField
              label="Mostrar encerradas"
              checked={showClosed}
              onCheckedChange={setShowClosed}
            />
            {canManageAllocation && (
              <Button
                type="button"

                onClick={() => {
                  setAllocationForm(emptyAllocation);
                  setAllocating(true);
                }}
              >
                Alocar aluno
              </Button>
            )}
          </div>
        </header>

        {atCapacity && (
          <div className="border-b border-warning-border bg-warning-surface px-4 py-2 text-xs text-warning-strong">
            Capacidade atingida ({allocatedCount}/{capacity}). Novas alocações
            exigirão justificativa de exceção.
          </div>
        )}

        <DataTable
          loading={allocations.isLoading}
          rows={allocations.data}
          keyOf={(row) => row.id}
          empty="Nenhum aluno alocado nesta rota"
          columns={[
            {
              header: "Aluno",
              render: (row) => (
                <div>
                  <p className="font-medium text-foreground">
                    {row.student_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.stop_name ?? "Sem parada definida"}
                  </p>
                </div>
              ),
            },
            {
              header: "Turno",
              render: (row) => SHIFT_LABELS[row.shift] ?? row.shift,
            },
            {
              header: "Rural",
              render: (row) =>
                row.uses_rural_transport ? (
                  <Badge variant="info">Sim</Badge>
                ) : (
                  <Badge variant="neutral">Não</Badge>
                ),
            },
            {
              header: "Jurisdição",
              render: (row) =>
                row.public_transport_jurisdiction
                  ? JURISDICTION_LABELS[row.public_transport_jurisdiction]
                  : "—",
            },
            {
              header: "Acessibilidade",
              render: (row) =>
                row.special_needs_transport ? (
                  <Badge variant="warning">Necessidade especial</Badge>
                ) : (
                  "—"
                ),
            },
            {
              header: "Período",
              render: (row) => (
                <span className="font-mono text-xs text-gov-text-secondary">
                  {formatDate(row.start_date)} —{" "}
                  {row.end_date ? formatDate(row.end_date) : "atual"}
                </span>
              ),
            },
            {
              header: "",
              className: "text-right",
              render: (row) =>
                canManageAllocation &&
                !row.end_date && (
                  <Button
                    type="button"
                    variant="destructiveOutline"
                    onClick={async () => {
                      const ok = await confirm({
                        title: `Encerrar a alocação de ${row.student_name}?`,
                        description:
                          "A vaga é liberada na ocupação da rota e a alocação permanece no histórico com data de término.",
                        confirmLabel: "Encerrar alocação",
                        destructive: true,
                      });
                      if (ok) {
                        closeAllocation.mutate(row.id);
                      }
                    }}
                  >
                    Encerrar
                  </Button>
                ),
            },
          ]}
        />
      </Card>

      {allocating && (
        <Modal
          title="Alocar aluno na rota"
          onClose={() => setAllocating(false)}
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAllocating(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"

                onClick={() => createAllocation.mutate()}
                disabled={createAllocation.isPending}
              >
                {createAllocation.isPending ? "Alocando…" : "Alocar"}
              </Button>
            </>
          }
        >
          <ErrorBanner message={errorMessage(createAllocation.error)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormField label="Aluno">
                <NativeSelect
                  value={allocationForm.student_id}
                  onChange={(event) =>
                    setAllocationForm({
                      ...allocationForm,
                      student_id: event.target.value,
                    })
                  }
                >
                  <option value="">Selecione o aluno</option>
                  {students.data?.items.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.full_name}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            </div>
            <div className="sm:col-span-2">
              <FormField label="Ponto de parada">
                <NativeSelect
                  value={allocationForm.stop_id}
                  onChange={(event) =>
                    setAllocationForm({
                      ...allocationForm,
                      stop_id: event.target.value,
                    })
                  }
                >
                  <option value="">Sem parada definida</option>
                  {routeStops.data?.items.map((stop) => (
                    <option key={stop.id} value={stop.id}>
                      {stop.name}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            </div>
            <FormField label="Jurisdição do transporte público">
              <NativeSelect
                value={allocationForm.public_transport_jurisdiction}
                onChange={(event) =>
                  setAllocationForm({
                    ...allocationForm,
                    public_transport_jurisdiction: event.target.value,
                  })
                }
              >
                <option value="">Não se aplica</option>
                {Object.entries(JURISDICTION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <div className="flex flex-col justify-end gap-2">
              <CheckboxField
                label="Utiliza transporte rural"
                checked={allocationForm.uses_rural_transport}
                onCheckedChange={(uses_rural_transport) =>
                  setAllocationForm({ ...allocationForm, uses_rural_transport })
                }
              />
              <CheckboxField
                label="Necessidade especial de transporte"
                checked={allocationForm.special_needs_transport}
                onCheckedChange={(special_needs_transport) =>
                  setAllocationForm({
                    ...allocationForm,
                    special_needs_transport,
                  })
                }
              />
            </div>
            {allocationForm.special_needs_transport && (
              <div className="sm:col-span-2">
                <FormField label="Descrição da necessidade especial">
                  <Textarea
                    rows={2}
                    value={allocationForm.special_needs_notes}
                    onChange={(event) =>
                      setAllocationForm({
                        ...allocationForm,
                        special_needs_notes: event.target.value,
                      })
                    }
                  />
                </FormField>
              </div>
            )}
            {atCapacity && (
              <div className="rounded-lg border border-warning-border bg-warning-surface p-3 sm:col-span-2">
                <FormField
                  label="Justificativa para exceder a capacidade"
                  hint={
                    canOverride
                      ? "Obrigatória e registrada na auditoria."
                      : "Sua conta não possui a permissão transport.allocation.override_capacity."
                  }
                >
                  <Textarea
                    rows={2}
                    value={allocationForm.override_justification}
                    disabled={!canOverride}
                    onChange={(event) =>
                      setAllocationForm({
                        ...allocationForm,
                        override_justification: event.target.value,
                      })
                    }
                  />
                </FormField>
              </div>
            )}
          </div>
        </Modal>
      )}

      {route.notes && (
        <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-xs text-gov-text-secondary">
          Observações: {route.notes}
        </p>
      )}
    </div>
  );
}
