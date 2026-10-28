import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Stop, StopPayload } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { MapView } from "@/components/MapView";
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
  PageHeader,
  Pagination,
  SearchBar,
  Textarea,
  useConfirm,
} from "@sysgov/ui";
import { errorMessage, fieldError, useSearch } from "@/lib/errors";
import { emptyToNull, numberOrNull } from "@/lib/format";
import { usePagedList } from "@/lib/queries";

const empty: StopPayload = {
  name: "",
  description: null,
  latitude: null,
  longitude: null,
  postal_code: null,
  street: null,
  number: null,
  complement: null,
  neighborhood: null,
  city: null,
  state_uf: null,
  landmark: null,
  is_active: true,
};

export default function StopsPage() {
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const search = useSearch();
  const [editing, setEditing] = useState<Stop | "new" | null>(null);
  const [form, setForm] = useState<StopPayload>(empty);

  const list = usePagedList<Stop>("stops", "/transport/stops", {
    page,
    per_page: 20,
    search: search.committed,
  });

  const save = useMutation({
    mutationFn: async () => {
      const body = JSON.stringify(form);
      if (editing === "new") {
        return api<Stop>("/transport/stops", { method: "POST", body });
      }
      return api<Stop>(`/transport/stops/${(editing as Stop).id}`, {
        method: "PUT",
        body,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stops"] });
      setEditing(null);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      api(`/transport/stops/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stops"] }),
  });

  const canManage = hasPermission("transport.stop.manage");

  const openNew = () => {
    setForm(empty);
    setEditing("new");
  };

  const openEdit = (stop: Stop) => {
    setForm({
      name: stop.name,
      description: stop.description ?? null,
      latitude: stop.latitude ?? null,
      longitude: stop.longitude ?? null,
      postal_code: stop.postal_code ?? null,
      street: stop.street ?? null,
      number: stop.number ?? null,
      complement: stop.complement ?? null,
      neighborhood: stop.neighborhood ?? null,
      city: stop.city ?? null,
      state_uf: stop.state_uf ?? null,
      landmark: stop.landmark ?? null,
      is_active: stop.is_active,
    });
    setEditing(stop);
  };

  return (
    <div>
      <PageHeader
        title="Pontos de parada"
        description="Localização geográfica dos pontos utilizados pelas rotas."
        actions={
          canManage && (
            <Button type="button" onClick={openNew}>
              Nova parada
            </Button>
          )
        }
      />

      <div className="mb-3">
        <SearchBar
          value={search.input}
          onChange={search.setInput}
          onSubmit={search.submit}
        />
      </div>

      <Card className="overflow-hidden">
        <DataTable
          loading={list.isLoading}
          rows={list.data?.items}
          keyOf={(row) => row.id}
          empty="Nenhum ponto de parada cadastrado"
          columns={[
            {
              header: "Parada",
              render: (row) => (
                <div>
                  <p className="font-medium text-foreground">{row.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.neighborhood ?? row.city ?? "—"}
                  </p>
                </div>
              ),
            },
            {
              header: "Coordenadas",
              render: (row) =>
                row.latitude !== null && row.longitude !== null ? (
                  <span className="font-mono text-xs text-gov-text-secondary">
                    {row.latitude.toFixed(5)}, {row.longitude.toFixed(5)}
                  </span>
                ) : (
                  <Badge variant="warning">Sem coordenadas</Badge>
                ),
            },
            {
              header: "Situação",
              render: (row) => (
                <Badge variant={row.is_active ? "success" : "neutral"}>
                  {row.is_active ? "Ativa" : "Inativa"}
                </Badge>
              ),
            },
            {
              header: "",
              className: "text-right",
              render: (row) =>
                canManage && (
                  <div className="flex justify-end gap-1">
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
                          title: `Inativar a parada "${row.name}"?`,
                          description:
                            "A parada sai das listagens padrão, mas permanece no itinerário histórico das rotas.",
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

      <div className="mt-5">
        <h2 className="mb-2 text-sm font-semibold text-foreground">
          Mapa das paradas
        </h2>
        <MapView
          height={300}
          connect={false}
          stops={(list.data?.items ?? []).map((stop) => ({
            id: stop.id,
            name: stop.name,
            latitude: stop.latitude ?? null,
            longitude: stop.longitude ?? null,
          }))}
        />
      </div>

      {editing && (
        <Modal
          title={editing === "new" ? "Nova parada" : "Editar parada"}
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormField label="Nome" error={fieldError(save.error, "name")}>
                <Input
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                />
              </FormField>
            </div>
            <FormField
              label="Latitude"
              error={fieldError(save.error, "latitude")}
            >
              <Input
                inputMode="decimal"
                placeholder="-22.9068"
                value={form.latitude ?? ""}
                onChange={(event) =>
                  setForm({
                    ...form,
                    latitude: numberOrNull(event.target.value),
                  })
                }
              />
            </FormField>
            <FormField
              label="Longitude"
              error={fieldError(save.error, "longitude")}
            >
              <Input
                inputMode="decimal"
                placeholder="-43.1729"
                value={form.longitude ?? ""}
                onChange={(event) =>
                  setForm({
                    ...form,
                    longitude: numberOrNull(event.target.value),
                  })
                }
              />
            </FormField>
            <FormField label="CEP">
              <Input
                value={form.postal_code ?? ""}
                onChange={(event) =>
                  setForm({
                    ...form,
                    postal_code: emptyToNull(event.target.value),
                  })
                }
              />
            </FormField>
            <FormField label="Bairro">
              <Input
                value={form.neighborhood ?? ""}
                onChange={(event) =>
                  setForm({
                    ...form,
                    neighborhood: emptyToNull(event.target.value),
                  })
                }
              />
            </FormField>
            <FormField label="Logradouro">
              <Input
                value={form.street ?? ""}
                onChange={(event) =>
                  setForm({ ...form, street: emptyToNull(event.target.value) })
                }
              />
            </FormField>
            <FormField label="Número">
              <Input
                value={form.number ?? ""}
                onChange={(event) =>
                  setForm({ ...form, number: emptyToNull(event.target.value) })
                }
              />
            </FormField>
            <FormField label="Complemento">
              <Input
                value={form.complement ?? ""}
                onChange={(event) =>
                  setForm({
                    ...form,
                    complement: emptyToNull(event.target.value),
                  })
                }
              />
            </FormField>
            <FormField label="Ponto de referência">
              <Input
                value={form.landmark ?? ""}
                onChange={(event) =>
                  setForm({
                    ...form,
                    landmark: emptyToNull(event.target.value),
                  })
                }
              />
            </FormField>
            <FormField label="Município">
              <Input
                value={form.city ?? ""}
                onChange={(event) =>
                  setForm({ ...form, city: emptyToNull(event.target.value) })
                }
              />
            </FormField>
            <FormField label="UF">
              <Input
                maxLength={2}
                value={form.state_uf ?? ""}
                onChange={(event) =>
                  setForm({
                    ...form,
                    state_uf: event.target.value.toUpperCase() || null,
                  })
                }
              />
            </FormField>
            <div className="sm:col-span-2">
              <FormField label="Descrição">
                <Textarea
                  rows={2}
                  value={form.description ?? ""}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      description: emptyToNull(event.target.value),
                    })
                  }
                />
              </FormField>
            </div>
            <CheckboxField
              label="Parada ativa"
              checked={form.is_active}
              onCheckedChange={(is_active) => setForm({ ...form, is_active })}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
