import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Company, Driver, DriverPayload } from "@/api/types";
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
  Textarea,
  useConfirm,
} from "@sysgov/ui";
import { errorMessage, fieldError, useSearch } from "@/lib/errors";
import { emptyToNull, formatDate } from "@/lib/format";
import { useOptions, usePagedList } from "@/lib/queries";

interface DriverForm {
  company_id: string;
  full_name: string;
  cpf: string;
  birth_date: string;
  cnh_number: string;
  cnh_category: string;
  cnh_first_issue_date: string;
  cnh_expiration_date: string;
  course_certificate: string;
  course_expiration_date: string;
  toxicological_exam_date: string;
  toxicological_expiration_date: string;
  phone: string;
  is_active: boolean;
  notes: string;
}

const empty: DriverForm = {
  company_id: "",
  full_name: "",
  cpf: "",
  birth_date: "",
  cnh_number: "",
  cnh_category: "D",
  cnh_first_issue_date: "",
  cnh_expiration_date: "",
  course_certificate: "",
  course_expiration_date: "",
  toxicological_exam_date: "",
  toxicological_expiration_date: "",
  phone: "",
  is_active: true,
  notes: "",
};

function toPayload(form: DriverForm): DriverPayload {
  return {
    company_id: form.company_id || null,
    full_name: form.full_name,
    cpf: form.cpf,
    birth_date: form.birth_date,
    cnh_number: form.cnh_number,
    cnh_category: form.cnh_category,
    cnh_first_issue_date: form.cnh_first_issue_date || null,
    cnh_expiration_date: form.cnh_expiration_date,
    course_certificate: emptyToNull(form.course_certificate),
    course_expiration_date: form.course_expiration_date || null,
    toxicological_exam_date: form.toxicological_exam_date || null,
    toxicological_expiration_date: form.toxicological_expiration_date || null,
    phone: emptyToNull(form.phone),
    is_active: form.is_active,
    notes: emptyToNull(form.notes),
  };
}

export default function DriversPage() {
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const search = useSearch();
  const [editing, setEditing] = useState<Driver | "new" | null>(null);
  const [form, setForm] = useState<DriverForm>(empty);

  const list = usePagedList<Driver>("drivers", "/transport/drivers", {
    page,
    per_page: 20,
    search: search.committed,
  });
  const companies = useOptions<Company>("companies", "/transport/companies");

  const save = useMutation({
    mutationFn: async () => {
      const body = JSON.stringify(toPayload(form));
      if (editing === "new") {
        return api<Driver>("/transport/drivers", { method: "POST", body });
      }
      return api<Driver>(`/transport/drivers/${(editing as Driver).id}`, {
        method: "PUT",
        body,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setEditing(null);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      api(`/transport/drivers/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["drivers"] }),
  });

  const canManage = hasPermission("transport.driver.manage");

  const openNew = () => {
    setForm(empty);
    setEditing("new");
  };

  const openEdit = (driver: Driver) => {
    setForm({
      company_id: driver.company_id ?? "",
      full_name: driver.full_name,
      cpf: driver.cpf,
      birth_date: driver.birth_date.slice(0, 10),
      cnh_number: driver.cnh_number,
      cnh_category: driver.cnh_category,
      cnh_first_issue_date: driver.cnh_first_issue_date?.slice(0, 10) ?? "",
      cnh_expiration_date: driver.cnh_expiration_date.slice(0, 10),
      course_certificate: driver.course_certificate ?? "",
      course_expiration_date: driver.course_expiration_date?.slice(0, 10) ?? "",
      toxicological_exam_date:
        driver.toxicological_exam_date?.slice(0, 10) ?? "",
      toxicological_expiration_date:
        driver.toxicological_expiration_date?.slice(0, 10) ?? "",
      phone: driver.phone ?? "",
      is_active: driver.is_active,
      notes: driver.notes ?? "",
    });
    setEditing(driver);
  };

  return (
    <div>
      <PageHeader
        title="Motoristas"
        description="Habilitação, curso especializado e exame toxicológico conforme CTB arts. 136 a 139."
        actions={
          canManage && (
            <Button type="button" onClick={openNew}>
              Novo motorista
            </Button>
          )
        }
      />

      <div className="mb-3">
        <SearchBar
          value={search.input}
          onChange={search.setInput}
          onSubmit={search.submit}
          placeholder="Buscar por nome"
        />
      </div>

      <Card className="overflow-hidden">
        <DataTable
          loading={list.isLoading}
          rows={list.data?.items}
          keyOf={(row) => row.id}
          empty="Nenhum motorista cadastrado"
          columns={[
            {
              header: "Motorista",
              render: (row) => (
                <div>
                  <p className="font-medium text-foreground">{row.full_name}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {row.cpf}
                  </p>
                </div>
              ),
            },
            {
              header: "Empresa",
              render: (row) => row.company_name ?? "—",
            },
            {
              header: "CNH",
              render: (row) => (
                <div>
                  <Badge variant="info">Categoria {row.cnh_category}</Badge>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    Vence {formatDate(row.cnh_expiration_date)}
                  </p>
                </div>
              ),
            },
            {
              header: "Conformidade",
              render: (row) =>
                row.issues.length === 0 ? (
                  <Badge variant="success">Regular</Badge>
                ) : (
                  <div className="space-y-1">
                    {row.issues.map((issue) => (
                      <p
                        key={issue}
                        className="text-xs font-medium text-red-600"
                      >
                        {issue}
                      </p>
                    ))}
                  </div>
                ),
            },
            {
              header: "Situação",
              render: (row) => (
                <Badge variant={row.is_active ? "success" : "neutral"}>
                  {row.is_active ? "Ativo" : "Inativo"}
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
                          title: `Inativar o motorista "${row.full_name}"?`,
                          description:
                            "O motorista deixa de ser elegível para novas rotas, preservando o histórico.",
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
          title={editing === "new" ? "Novo motorista" : "Editar motorista"}
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
            <FormField
              label="Nome completo"
              error={fieldError(save.error, "full_name")}
            >
              <Input
                value={form.full_name}
                onChange={(event) =>
                  setForm({ ...form, full_name: event.target.value })
                }
              />
            </FormField>
            <FormField label="CPF" error={fieldError(save.error, "cpf")}>
              <Input
                value={form.cpf}
                placeholder="000.000.000-00"
                onChange={(event) =>
                  setForm({ ...form, cpf: event.target.value })
                }
              />
            </FormField>
            <FormField
              label="Data de nascimento"
              error={fieldError(save.error, "birth_date")}
            >
              <Input
                type="date"

                value={form.birth_date}
                onChange={(event) =>
                  setForm({ ...form, birth_date: event.target.value })
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
            <FormField
              label="Número da CNH"
              error={fieldError(save.error, "cnh_number")}
            >
              <Input
                value={form.cnh_number}
                onChange={(event) =>
                  setForm({ ...form, cnh_number: event.target.value })
                }
              />
            </FormField>
            <FormField
              label="Categoria da CNH"
              error={fieldError(save.error, "cnh_category")}
            >
              <NativeSelect
                value={form.cnh_category}
                onChange={(event) =>
                  setForm({ ...form, cnh_category: event.target.value })
                }
              >
                <option value="D">D</option>
                <option value="E">E</option>
              </NativeSelect>
            </FormField>
            <FormField
              label="Data da 1ª habilitação"
              error={fieldError(save.error, "cnh_first_issue_date")}
            >
              <Input
                type="date"

                value={form.cnh_first_issue_date}
                onChange={(event) =>
                  setForm({ ...form, cnh_first_issue_date: event.target.value })
                }
              />
            </FormField>
            <FormField
              label="Validade da CNH"
              error={fieldError(save.error, "cnh_expiration_date")}
            >
              <Input
                type="date"

                value={form.cnh_expiration_date}
                onChange={(event) =>
                  setForm({ ...form, cnh_expiration_date: event.target.value })
                }
              />
            </FormField>
            <FormField label="Certificado do curso">
              <Input
                value={form.course_certificate}
                onChange={(event) =>
                  setForm({ ...form, course_certificate: event.target.value })
                }
              />
            </FormField>
            <FormField label="Validade do curso especializado">
              <Input
                type="date"

                value={form.course_expiration_date}
                onChange={(event) =>
                  setForm({
                    ...form,
                    course_expiration_date: event.target.value,
                  })
                }
              />
            </FormField>
            <FormField label="Data do exame toxicológico">
              <Input
                type="date"

                value={form.toxicological_exam_date}
                onChange={(event) =>
                  setForm({
                    ...form,
                    toxicological_exam_date: event.target.value,
                  })
                }
              />
            </FormField>
            <FormField label="Validade do toxicológico">
              <Input
                type="date"

                value={form.toxicological_expiration_date}
                onChange={(event) =>
                  setForm({
                    ...form,
                    toxicological_expiration_date: event.target.value,
                  })
                }
              />
            </FormField>
            <FormField label="Telefone">
              <Input
                value={form.phone}
                onChange={(event) =>
                  setForm({ ...form, phone: event.target.value })
                }
              />
            </FormField>
            <div className="sm:col-span-2">
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
            <CheckboxField
              label="Motorista ativo (exige documentação válida)"
              checked={form.is_active}
              onCheckedChange={(is_active) => setForm({ ...form, is_active })}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
