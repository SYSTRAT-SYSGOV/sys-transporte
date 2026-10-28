import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import {
  Company,
  Driver,
  Inspection,
  InspectionPayload,
  Vehicle,
  VEHICLE_TYPE_LABELS,
  VehiclePayload,
} from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import {
  Badge,
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
  Skeleton,
  Textarea,
  useConfirm,
} from "@sysgov/ui";
import { errorMessage, fieldError, useSearch } from "@/lib/errors";
import { emptyToNull, formatDate, toDateInput } from "@/lib/format";
import { useOptions, usePagedList } from "@/lib/queries";

interface VehicleForm {
  company_id: string;
  default_driver_id: string;
  description: string;
  plate: string;
  renavam: string;
  data_licenca: string;
  chassis: string;
  brand_model: string;
  manufacture_year: string;
  model_year: string;
  passenger_capacity: string;
  network_type: string;
  vehicle_type_inep: string;
  is_exclusive_school_use: boolean;
  is_accessible_disability: boolean;
  last_inspection_date: string;
  inspection_certificate_number: string;
  inspection_valid_until: string;
  is_active: boolean;
  deactivation_reason: string;
  notes: string;
}

const empty: VehicleForm = {
  company_id: "",
  default_driver_id: "",
  description: "",
  plate: "",
  renavam: "",
  data_licenca: "",
  chassis: "",
  brand_model: "",
  manufacture_year: "",
  model_year: "",
  passenger_capacity: "",
  network_type: "rural",
  vehicle_type_inep: "1",
  is_exclusive_school_use: true,
  is_accessible_disability: false,
  last_inspection_date: "",
  inspection_certificate_number: "",
  inspection_valid_until: "",
  is_active: true,
  deactivation_reason: "",
  notes: "",
};

function toPayload(form: VehicleForm): VehiclePayload {
  return {
    company_id: form.company_id || null,
    default_driver_id: form.default_driver_id || null,
    description: form.description,
    plate: form.plate,
    renavam: emptyToNull(form.renavam),
    data_licenca: form.data_licenca || null,
    chassis: emptyToNull(form.chassis),
    brand_model: emptyToNull(form.brand_model),
    manufacture_year: form.manufacture_year
      ? Number(form.manufacture_year)
      : null,
    model_year: form.model_year ? Number(form.model_year) : null,
    passenger_capacity: Number(form.passenger_capacity || 0),
    network_type: form.network_type,
    vehicle_type_inep: Number(form.vehicle_type_inep),
    is_exclusive_school_use: form.is_exclusive_school_use,
    is_accessible_disability: form.is_accessible_disability,
    last_inspection_date: form.last_inspection_date || null,
    inspection_certificate_number: emptyToNull(
      form.inspection_certificate_number,
    ),
    inspection_valid_until: form.inspection_valid_until || null,
    is_active: form.is_active,
    deactivation_reason: emptyToNull(form.deactivation_reason),
    notes: emptyToNull(form.notes),
  };
}

const emptyInspection: InspectionPayload = {
  inspection_date: "",
  certificate_number: "",
  valid_until: "",
  notes: null,
};

export default function VehiclesPage() {
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const search = useSearch();
  const [editing, setEditing] = useState<Vehicle | "new" | null>(null);
  const [form, setForm] = useState<VehicleForm>(empty);
  const [inspecting, setInspecting] = useState<Vehicle | null>(null);
  const [inspectionForm, setInspectionForm] =
    useState<InspectionPayload>(emptyInspection);

  const list = usePagedList<Vehicle>("vehicles", "/transport/vehicles", {
    page,
    per_page: 20,
    search: search.committed,
  });
  const companies = useOptions<Company>("companies", "/transport/companies");
  const drivers = useOptions<Driver>("drivers", "/transport/drivers");

  const inspections = useQuery({
    queryKey: ["inspections", inspecting?.id],
    queryFn: () =>
      api<Inspection[]>(`/transport/vehicles/${inspecting?.id}/inspections`),
    enabled: Boolean(inspecting),
  });

  const save = useMutation({
    mutationFn: async () => {
      const body = JSON.stringify(toPayload(form));
      if (editing === "new") {
        return api<Vehicle>("/transport/vehicles", { method: "POST", body });
      }
      return api<Vehicle>(`/transport/vehicles/${(editing as Vehicle).id}`, {
        method: "PUT",
        body,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setEditing(null);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      api(`/transport/vehicles/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vehicles"] }),
  });

  const addInspection = useMutation({
    mutationFn: async () => {
      if (!inspecting) {
        throw new Error("Veículo não selecionado");
      }
      return api<Inspection>(
        `/transport/vehicles/${inspecting.id}/inspections`,
        {
          method: "POST",
          body: JSON.stringify(inspectionForm),
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["inspections", inspecting?.id],
      });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setInspectionForm(emptyInspection);
    },
  });

  const canManage = hasPermission("transport.vehicle.manage");
  const canInspect = hasPermission("transport.inspection.manage");

  const openNew = () => {
    setForm(empty);
    setEditing("new");
  };

  const openEdit = (vehicle: Vehicle) => {
    setForm({
      company_id: vehicle.company_id ?? "",
      default_driver_id: vehicle.default_driver_id ?? "",
      description: vehicle.description,
      plate: vehicle.plate,
      renavam: vehicle.renavam ?? "",
      data_licenca: toDateInput(vehicle.data_licenca),
      chassis: vehicle.chassis ?? "",
      brand_model: vehicle.brand_model ?? "",
      manufacture_year: vehicle.manufacture_year?.toString() ?? "",
      model_year: vehicle.model_year?.toString() ?? "",
      passenger_capacity: vehicle.passenger_capacity.toString(),
      network_type: vehicle.network_type,
      vehicle_type_inep: vehicle.vehicle_type_inep.toString(),
      is_exclusive_school_use: vehicle.is_exclusive_school_use,
      is_accessible_disability: vehicle.is_accessible_disability,
      last_inspection_date: toDateInput(vehicle.last_inspection_date),
      inspection_certificate_number:
        vehicle.inspection_certificate_number ?? "",
      inspection_valid_until: toDateInput(vehicle.inspection_valid_until),
      is_active: vehicle.is_active,
      deactivation_reason: vehicle.deactivation_reason ?? "",
      notes: vehicle.notes ?? "",
    });
    setEditing(vehicle);
  };

  return (
    <div>
      <PageHeader
        title="Veículos"
        description="Capacidade, acessibilidade, tipologia Inep e vistoria semestral."
        actions={
          canManage && (
            <Button type="button" onClick={openNew}>
              Novo veículo
            </Button>
          )
        }
      />

      <div className="mb-3">
        <SearchBar
          value={search.input}
          onChange={search.setInput}
          onSubmit={search.submit}
          placeholder="Buscar por descrição ou placa"
        />
      </div>

      <Card className="overflow-hidden">
        <DataTable
          loading={list.isLoading}
          rows={list.data?.items}
          keyOf={(row) => row.id}
          empty="Nenhum veículo cadastrado"
          columns={[
            {
              header: "Veículo",
              render: (row) => (
                <div>
                  <p className="font-medium text-foreground">
                    {row.description}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {row.plate}
                  </p>
                </div>
              ),
            },
            {
              header: "Capacidade",
              render: (row) => (
                <span className="font-mono">
                  {row.passenger_capacity} lugares
                </span>
              ),
            },
            {
              header: "Tipologia Inep",
              render: (row) =>
                VEHICLE_TYPE_LABELS[row.vehicle_type_inep] ??
                row.vehicle_type_inep,
            },
            {
              header: "Acessível",
              render: (row) =>
                row.is_accessible_disability ? (
                  <Badge variant="success">Sim</Badge>
                ) : (
                  <Badge variant="neutral">Não</Badge>
                ),
            },
            {
              header: "Vistoria",
              render: (row) => (
                <div>
                  <Badge
                    variant={row.inspection_valid ? "success" : "critical"}
                  >
                    {row.inspection_valid ? "Válida" : "Vencida/ausente"}
                  </Badge>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    até {formatDate(row.inspection_valid_until)}
                  </p>
                </div>
              ),
            },
            {
              header: "",
              className: "text-right",
              render: (row) => (
                <div className="flex justify-end gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setInspecting(row);
                      setInspectionForm(emptyInspection);
                    }}
                  >
                    Vistorias
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
                            title: `Inativar o veículo "${row.plate}"?`,
                            description:
                              "O veículo deixa de ser elegível para novas rotas e mantém o histórico de vistorias.",
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
          title={editing === "new" ? "Novo veículo" : "Editar veículo"}
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
                label="Descrição"
                error={fieldError(save.error, "description")}
              >
                <Input
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                />
              </FormField>
            </div>
            <FormField label="Placa" error={fieldError(save.error, "plate")}>
              <Input
                className="font-mono uppercase"
                value={form.plate}
                onChange={(event) =>
                  setForm({ ...form, plate: event.target.value.toUpperCase() })
                }
              />
            </FormField>
            <FormField label="Empresa">
              <NativeSelect
                value={form.company_id}
                onChange={(event) =>
                  setForm({ ...form, company_id: event.target.value })
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
            <FormField label="Renavam">
              <Input
                value={form.renavam}
                onChange={(event) =>
                  setForm({ ...form, renavam: event.target.value })
                }
              />
            </FormField>
            <FormField label="Data da licença">
              <Input
                type="date"

                value={form.data_licenca}
                onChange={(event) =>
                  setForm({ ...form, data_licenca: event.target.value })
                }
              />
            </FormField>
            <FormField label="Condutor padrão">
              <NativeSelect
                value={form.default_driver_id}
                onChange={(event) =>
                  setForm({ ...form, default_driver_id: event.target.value })
                }
              >
                <option value="">Não informado</option>
                {drivers.data?.items.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.full_name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Chassi">
              <Input
                value={form.chassis}
                onChange={(event) =>
                  setForm({ ...form, chassis: event.target.value })
                }
              />
            </FormField>
            <FormField label="Marca/modelo">
              <Input
                value={form.brand_model}
                onChange={(event) =>
                  setForm({ ...form, brand_model: event.target.value })
                }
              />
            </FormField>
            <FormField label="Ano de fabricação">
              <Input
                inputMode="numeric"
                value={form.manufacture_year}
                onChange={(event) =>
                  setForm({ ...form, manufacture_year: event.target.value })
                }
              />
            </FormField>
            <FormField label="Ano do modelo">
              <Input
                inputMode="numeric"
                value={form.model_year}
                onChange={(event) =>
                  setForm({ ...form, model_year: event.target.value })
                }
              />
            </FormField>
            <FormField
              label="Capacidade de passageiros"
              error={fieldError(save.error, "passenger_capacity")}
            >
              <Input
                inputMode="numeric"
                value={form.passenger_capacity}
                onChange={(event) =>
                  setForm({ ...form, passenger_capacity: event.target.value })
                }
              />
            </FormField>
            <FormField label="Tipo de rede">
              <NativeSelect
                value={form.network_type}
                onChange={(event) =>
                  setForm({ ...form, network_type: event.target.value })
                }
              >
                <option value="rural">Rural</option>
                <option value="urban">Urbana</option>
                <option value="mixed">Mista</option>
              </NativeSelect>
            </FormField>
            <FormField
              label="Tipologia Inep"
              error={fieldError(save.error, "vehicle_type_inep")}
            >
              <NativeSelect
                value={form.vehicle_type_inep}
                onChange={(event) =>
                  setForm({ ...form, vehicle_type_inep: event.target.value })
                }
              >
                {Object.entries(VEHICLE_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Data da última vistoria">
              <Input
                type="date"

                value={form.last_inspection_date}
                onChange={(event) =>
                  setForm({ ...form, last_inspection_date: event.target.value })
                }
              />
            </FormField>
            <FormField label="Certificado da vistoria">
              <Input
                value={form.inspection_certificate_number}
                onChange={(event) =>
                  setForm({
                    ...form,
                    inspection_certificate_number: event.target.value,
                  })
                }
              />
            </FormField>
            <FormField
              label="Vistoria válida até"
              error={fieldError(save.error, "inspection_valid_until")}
            >
              <Input
                type="date"

                value={form.inspection_valid_until}
                onChange={(event) =>
                  setForm({
                    ...form,
                    inspection_valid_until: event.target.value,
                  })
                }
              />
            </FormField>
            <CheckboxField
              label="Uso exclusivo escolar"
              checked={form.is_exclusive_school_use}
              onCheckedChange={(is_exclusive_school_use) =>
                setForm({ ...form, is_exclusive_school_use })
              }
            />
            <CheckboxField
              label="Acessível (cadeirante)"
              checked={form.is_accessible_disability}
              onCheckedChange={(is_accessible_disability) =>
                setForm({ ...form, is_accessible_disability })
              }
            />
            <CheckboxField
              label="Veículo ativo"
              checked={form.is_active}
              onCheckedChange={(is_active) => setForm({ ...form, is_active })}
            />
            <div className="sm:col-span-3">
              <FormField label="Observações">
                <Textarea
                  rows={2}
                  value={form.notes}
                  onChange={(event) =>
                    setForm({ ...form, notes: event.target.value })
                  }
                />
              </FormField>
            </div>
          </div>
        </Modal>
      )}

      {inspecting && (
        <Modal
          title={`Vistorias — ${inspecting.description} (${inspecting.plate})`}
          onClose={() => setInspecting(null)}
          wide
        >
          <div className="mb-5">
            <h3 className="mb-2 text-sm font-semibold text-foreground">
              Histórico
            </h3>
            {inspections.isLoading && <Skeleton className="h-16 w-full" />}
            {inspections.data && inspections.data.length === 0 && (
              <p className="rounded-lg bg-muted/50 px-3 py-4 text-sm text-muted-foreground">
                Nenhuma vistoria registrada.
              </p>
            )}
            <ul className="divide-y divide-border">
              {inspections.data?.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <div>
                    <p className="font-mono font-medium text-foreground">
                      {item.certificate_number}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      Realizada em {formatDate(item.inspection_date)}
                    </p>
                  </div>
                  <span className="font-mono text-xs text-gov-text-secondary">
                    válida até {formatDate(item.valid_until)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {canInspect && (
            <div className="rounded-lg border border-border p-3">
              <h3 className="mb-3 text-sm font-semibold text-foreground">
                Registrar vistoria
              </h3>
              <ErrorBanner message={errorMessage(addInspection.error)} />
              <div className="grid gap-3 sm:grid-cols-3">
                <FormField label="Data da vistoria">
                  <Input
                    type="date"

                    value={inspectionForm.inspection_date}
                    onChange={(event) =>
                      setInspectionForm({
                        ...inspectionForm,
                        inspection_date: event.target.value,
                      })
                    }
                  />
                </FormField>
                <FormField label="Certificado">
                  <Input
                    value={inspectionForm.certificate_number}
                    onChange={(event) =>
                      setInspectionForm({
                        ...inspectionForm,
                        certificate_number: event.target.value,
                      })
                    }
                  />
                </FormField>
                <FormField label="Válida até">
                  <Input
                    type="date"

                    value={inspectionForm.valid_until}
                    onChange={(event) =>
                      setInspectionForm({
                        ...inspectionForm,
                        valid_until: event.target.value,
                      })
                    }
                  />
                </FormField>
                <div className="sm:col-span-3">
                  <Button
                    type="button"

                    onClick={() => addInspection.mutate()}
                    disabled={addInspection.isPending}
                  >
                    {addInspection.isPending
                      ? "Registrando…"
                      : "Registrar vistoria"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
