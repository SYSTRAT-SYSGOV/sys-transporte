import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { NETWORK_LABELS, School, SchoolPayload } from "@/api/types";
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
  useConfirm,
} from "@sysgov/ui";
import { errorMessage, fieldError, useSearch } from "@/lib/errors";
import { emptyToNull } from "@/lib/format";
import { usePagedList } from "@/lib/queries";

const empty: SchoolPayload = {
  name: "",
  inep_code: null,
  education_network: "municipal",
  city: null,
  state_uf: null,
  address: null,
  is_active: true,
};

export default function SchoolsPage() {
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const search = useSearch();
  const [editing, setEditing] = useState<School | "new" | null>(null);
  const [form, setForm] = useState<SchoolPayload>(empty);

  const list = usePagedList<School>("schools", "/registry/schools", {
    page,
    per_page: 20,
    search: search.committed,
  });

  const save = useMutation({
    mutationFn: async () => {
      const body = JSON.stringify(form);
      if (editing === "new") {
        return api<School>("/registry/schools", { method: "POST", body });
      }
      return api<School>(`/registry/schools/${(editing as School).id}`, {
        method: "PUT",
        body,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schools"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setEditing(null);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      api(`/registry/schools/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["schools"] }),
  });

  const canManage = hasPermission("registry.school.manage");

  const openNew = () => {
    setForm(empty);
    setEditing("new");
  };

  const openEdit = (school: School) => {
    setForm({
      name: school.name,
      inep_code: school.inep_code ?? null,
      education_network: school.education_network,
      city: school.city ?? null,
      state_uf: school.state_uf ?? null,
      address: school.address ?? null,
      is_active: school.is_active,
    });
    setEditing(school);
  };

  return (
    <div>
      <PageHeader
        title="Escolas"
        description="Unidades atendidas pelo transporte escolar e seus códigos INEP."
        actions={
          canManage && (
            <Button type="button" onClick={openNew}>
              Nova escola
            </Button>
          )
        }
      />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
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
          empty="Nenhuma escola cadastrada"
          columns={[
            {
              header: "Escola",
              render: (row) => (
                <div>
                  <p className="font-medium text-foreground">{row.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    INEP {row.inep_code ?? "—"}
                  </p>
                </div>
              ),
            },
            {
              header: "Rede",
              render: (row) =>
                NETWORK_LABELS[row.education_network] ?? row.education_network,
            },
            {
              header: "Município",
              render: (row) =>
                `${row.city ?? "—"}${row.state_uf ? `/${row.state_uf}` : ""}`,
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
                          title: `Inativar a escola "${row.name}"?`,
                          description:
                            "A escola sai das listagens padrão, mas continua no histórico das rotas existentes.",
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

      {editing && (
        <Modal
          title={editing === "new" ? "Nova escola" : "Editar escola"}
          onClose={() => setEditing(null)}
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
              label="Código INEP"
              error={fieldError(save.error, "inep_code")}
            >
              <Input
                value={form.inep_code ?? ""}
                onChange={(event) =>
                  setForm({
                    ...form,
                    inep_code: emptyToNull(event.target.value),
                  })
                }
              />
            </FormField>
            <FormField label="Rede de ensino">
              <NativeSelect
                value={form.education_network}
                onChange={(event) =>
                  setForm({ ...form, education_network: event.target.value })
                }
              >
                {Object.entries(NETWORK_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Município" error={fieldError(save.error, "city")}>
              <Input
                value={form.city ?? ""}
                onChange={(event) =>
                  setForm({ ...form, city: emptyToNull(event.target.value) })
                }
              />
            </FormField>
            <FormField label="UF" error={fieldError(save.error, "state_uf")}>
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
              <FormField label="Endereço">
                <Input
                  value={form.address ?? ""}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      address: emptyToNull(event.target.value),
                    })
                  }
                />
              </FormField>
            </div>
            <CheckboxField
              label="Escola ativa"
              checked={form.is_active}
              onCheckedChange={(is_active) => setForm({ ...form, is_active })}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
