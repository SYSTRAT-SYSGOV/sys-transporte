import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Company, CompanyPayload } from "@/api/types";
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
  PageHeader,
  Pagination,
  SearchBar,
  Textarea,
  useConfirm,
} from "@sysgov/ui";
import { errorMessage, fieldError, useSearch } from "@/lib/errors";
import { emptyToNull, formatDate } from "@/lib/format";
import { usePagedList } from "@/lib/queries";

const empty: CompanyPayload = {
  legal_name: "",
  cnpj: "",
  contract_number: null,
  contract_start_date: null,
  contract_end_date: null,
  responsible_name: null,
  phone: null,
  email: null,
  is_active: true,
  notes: null,
};

export default function CompaniesPage() {
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const search = useSearch();
  const [editing, setEditing] = useState<Company | "new" | null>(null);
  const [form, setForm] = useState<CompanyPayload>(empty);

  const list = usePagedList<Company>("companies", "/transport/companies", {
    page,
    per_page: 20,
    search: search.committed,
  });

  const save = useMutation({
    mutationFn: async () => {
      const body = JSON.stringify(form);
      if (editing === "new") {
        return api<Company>("/transport/companies", { method: "POST", body });
      }
      return api<Company>(`/transport/companies/${(editing as Company).id}`, {
        method: "PUT",
        body,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      setEditing(null);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      api(`/transport/companies/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["companies"] }),
  });

  const canManage = hasPermission("transport.company.manage");

  const openNew = () => {
    setForm(empty);
    setEditing("new");
  };

  const openEdit = (company: Company) => {
    setForm({
      legal_name: company.legal_name,
      cnpj: company.cnpj,
      contract_number: company.contract_number ?? null,
      contract_start_date: company.contract_start_date ?? null,
      contract_end_date: company.contract_end_date ?? null,
      responsible_name: company.responsible_name ?? null,
      phone: company.phone ?? null,
      email: company.email ?? null,
      is_active: company.is_active,
      notes: company.notes ?? null,
    });
    setEditing(company);
  };

  return (
    <div>
      <PageHeader
        title="Empresas de transporte"
        description="Prestadoras contratadas, vigência contratual e responsáveis."
        actions={
          canManage && (
            <Button type="button" onClick={openNew}>
              Nova empresa
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
          empty="Nenhuma empresa cadastrada"
          columns={[
            {
              header: "Empresa",
              render: (row) => (
                <div>
                  <p className="font-medium text-foreground">
                    {row.legal_name}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {row.cnpj}
                  </p>
                </div>
              ),
            },
            {
              header: "Contrato",
              render: (row) => (
                <div>
                  <p className="font-mono text-xs text-gov-text-secondary">
                    {row.contract_number ?? "—"}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {formatDate(row.contract_start_date)} a{" "}
                    {formatDate(row.contract_end_date)}
                  </p>
                </div>
              ),
            },
            {
              header: "Vigência",
              render: (row) =>
                row.contract_expired ? (
                  <Badge variant="critical">Vencido</Badge>
                ) : (
                  <Badge variant="success">Regular</Badge>
                ),
            },
            {
              header: "Contato",
              render: (row) => (
                <div className="text-xs text-gov-text-secondary">
                  <p>{row.responsible_name ?? "—"}</p>
                  <p className="text-muted-foreground">
                    {row.phone ?? row.email ?? "—"}
                  </p>
                </div>
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
                          title: `Inativar a empresa "${row.legal_name}"?`,
                          description:
                            "A empresa sai das listagens padrão; veículos e rotas históricos continuam vinculados.",
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
          title={editing === "new" ? "Nova empresa" : "Editar empresa"}
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
              <FormField
                label="Razão social"
                error={fieldError(save.error, "legal_name")}
              >
                <Input
                  value={form.legal_name}
                  onChange={(event) =>
                    setForm({ ...form, legal_name: event.target.value })
                  }
                />
              </FormField>
            </div>
            <FormField label="CNPJ" error={fieldError(save.error, "cnpj")}>
              <Input
                value={form.cnpj}
                placeholder="00.000.000/0000-00"
                onChange={(event) =>
                  setForm({ ...form, cnpj: event.target.value })
                }
              />
            </FormField>
            <FormField label="Número do contrato">
              <Input
                value={form.contract_number ?? ""}
                onChange={(event) =>
                  setForm({
                    ...form,
                    contract_number: emptyToNull(event.target.value),
                  })
                }
              />
            </FormField>
            <FormField label="Início do contrato">
              <Input
                type="date"

                value={form.contract_start_date ?? ""}
                onChange={(event) =>
                  setForm({
                    ...form,
                    contract_start_date: event.target.value || null,
                  })
                }
              />
            </FormField>
            <FormField
              label="Fim do contrato"
              error={fieldError(save.error, "contract_end_date")}
            >
              <Input
                type="date"

                value={form.contract_end_date ?? ""}
                onChange={(event) =>
                  setForm({
                    ...form,
                    contract_end_date: event.target.value || null,
                  })
                }
              />
            </FormField>
            <FormField label="Responsável">
              <Input
                value={form.responsible_name ?? ""}
                onChange={(event) =>
                  setForm({
                    ...form,
                    responsible_name: emptyToNull(event.target.value),
                  })
                }
              />
            </FormField>
            <FormField label="Telefone">
              <Input
                value={form.phone ?? ""}
                onChange={(event) =>
                  setForm({ ...form, phone: emptyToNull(event.target.value) })
                }
              />
            </FormField>
            <FormField label="E-mail">
              <Input
                type="email"

                value={form.email ?? ""}
                onChange={(event) =>
                  setForm({ ...form, email: emptyToNull(event.target.value) })
                }
              />
            </FormField>
            <div className="sm:col-span-2">
              <FormField label="Observações">
                <Textarea
                  rows={3}
                  value={form.notes ?? ""}
                  onChange={(event) =>
                    setForm({ ...form, notes: emptyToNull(event.target.value) })
                  }
                />
              </FormField>
            </div>
            <CheckboxField
              label="Empresa ativa"
              checked={form.is_active}
              onCheckedChange={(is_active) => setForm({ ...form, is_active })}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
