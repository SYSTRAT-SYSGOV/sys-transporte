import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Student, StudentDetail, StudentPayload } from "@/api/types";
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

interface GuardianForm {
  id?: string;
  full_name: string;
  document: string;
  phone: string;
  email: string;
  relationship: string;
  is_primary: boolean;
}

interface StudentForm {
  full_name: string;
  birth_date: string;
  document: string;
  notes: string;
  guardians: GuardianForm[];
}

const emptyGuardian: GuardianForm = {
  full_name: "",
  document: "",
  phone: "",
  email: "",
  relationship: "Mãe",
  is_primary: true,
};

const empty: StudentForm = {
  full_name: "",
  birth_date: "",
  document: "",
  notes: "",
  guardians: [{ ...emptyGuardian }],
};

function toPayload(form: StudentForm): StudentPayload {
  return {
    full_name: form.full_name,
    birth_date: form.birth_date,
    document: emptyToNull(form.document),
    notes: emptyToNull(form.notes),
    guardians: form.guardians
      .filter((guardian) => guardian.full_name.trim() !== "")
      .map((guardian) => ({
        id: guardian.id ?? null,
        full_name: guardian.full_name,
        document: emptyToNull(guardian.document),
        phone: emptyToNull(guardian.phone),
        email: emptyToNull(guardian.email),
        relationship: guardian.relationship,
        is_primary: guardian.is_primary,
      })),
  };
}

export default function StudentsPage() {
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const search = useSearch();
  const [editing, setEditing] = useState<Student | "new" | null>(null);
  const [form, setForm] = useState<StudentForm>(empty);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const list = usePagedList<Student>("students", "/registry/students", {
    page,
    per_page: 20,
    search: search.committed,
  });

  const save = useMutation({
    mutationFn: async () => {
      const body = JSON.stringify(toPayload(form));
      if (editing === "new") {
        return api<{ id: string }>("/registry/students", {
          method: "POST",
          body,
        });
      }
      return api(`/registry/students/${(editing as Student).id}`, {
        method: "PUT",
        body,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setEditing(null);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      api(`/registry/students/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["students"] }),
  });

  const canManage = hasPermission("registry.student.manage");

  const openNew = () => {
    setForm({ ...empty, guardians: [{ ...emptyGuardian }] });
    setEditing("new");
  };

  const openEdit = async (student: Student) => {
    setLoadingDetail(true);
    try {
      const detail = await api<StudentDetail>(
        `/registry/students/${student.id}`,
      );
      setForm({
        full_name: detail.student.full_name,
        birth_date: detail.student.birth_date.slice(0, 10),
        document: detail.student.document ?? "",
        notes: detail.student.notes ?? "",
        guardians:
          detail.guardians.length > 0
            ? detail.guardians.map((guardian) => ({
                id: guardian.id,
                full_name: guardian.full_name,
                document: guardian.document ?? "",
                phone: guardian.phone ?? "",
                email: guardian.email ?? "",
                relationship: guardian.relationship,
                is_primary: guardian.is_primary,
              }))
            : [{ ...emptyGuardian }],
      });
      setEditing(student);
    } finally {
      setLoadingDetail(false);
    }
  };

  const updateGuardian = (index: number, patch: Partial<GuardianForm>) => {
    setForm((current) => ({
      ...current,
      guardians: current.guardians.map((guardian, position) =>
        position === index ? { ...guardian, ...patch } : guardian,
      ),
    }));
  };

  const addGuardian = () => {
    setForm((current) => ({
      ...current,
      guardians: [
        ...current.guardians,
        { ...emptyGuardian, relationship: "Outro", is_primary: false },
      ],
    }));
  };

  const removeGuardian = (index: number) => {
    setForm((current) => ({
      ...current,
      guardians: current.guardians.filter((_, position) => position !== index),
    }));
  };

  return (
    <div>
      <PageHeader
        title="Alunos"
        description="Cadastro dos estudantes e seus responsáveis legais."
        actions={
          canManage && (
            <Button type="button" onClick={openNew}>
              Novo aluno
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
          loading={list.isLoading || loadingDetail}
          rows={list.data?.items}
          keyOf={(row) => row.id}
          empty="Nenhum aluno cadastrado"
          columns={[
            {
              header: "Aluno",
              render: (row) => (
                <div>
                  <p className="font-medium text-foreground">{row.full_name}</p>
                  <p className="font-mono text-xs text-muted-foreground tabular-nums">
                    {row.document ?? "Sem documento"}
                  </p>
                </div>
              ),
            },
            {
              header: "Nascimento",
              render: (row) => (
                <span className="font-mono">{formatDate(row.birth_date)}</span>
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
                      onClick={() => void openEdit(row)}
                    >
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="destructiveOutline"
                      onClick={async () => {
                        const ok = await confirm({
                          title: `Inativar o aluno "${row.full_name}"?`,
                          description:
                            "O aluno deixa de aparecer nas listagens padrão e mantém o histórico de matrículas e alocações.",
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
          title={editing === "new" ? "Novo aluno" : "Editar aluno"}
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
            </div>
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
            <FormField label="Documento">
              <Input
                value={form.document}
                onChange={(event) =>
                  setForm({ ...form, document: event.target.value })
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
          </div>

          <div className="mt-5 border-t border-border pt-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Responsáveis legais
              </h3>
              <Button type="button" variant="outline" onClick={addGuardian}>
                Adicionar responsável
              </Button>
            </div>
            {fieldError(save.error, "guardians") && (
              <p className="mb-2 text-xs font-medium text-red-600">
                {fieldError(save.error, "guardians")}
              </p>
            )}
            <div className="space-y-3">
              {form.guardians.map((guardian, index) => (
                <div
                  key={guardian.id ?? `novo-${index}`}
                  className="rounded-lg border border-border p-3"
                >
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <FormField label="Nome">
                        <Input
                          value={guardian.full_name}
                          onChange={(event) =>
                            updateGuardian(index, {
                              full_name: event.target.value,
                            })
                          }
                        />
                      </FormField>
                    </div>
                    <FormField label="Parentesco">
                      <Input
                        value={guardian.relationship}
                        onChange={(event) =>
                          updateGuardian(index, {
                            relationship: event.target.value,
                          })
                        }
                      />
                    </FormField>
                    <FormField label="Documento">
                      <Input
                        value={guardian.document}
                        onChange={(event) =>
                          updateGuardian(index, {
                            document: event.target.value,
                          })
                        }
                      />
                    </FormField>
                    <FormField label="Telefone">
                      <Input
                        value={guardian.phone}
                        onChange={(event) =>
                          updateGuardian(index, { phone: event.target.value })
                        }
                      />
                    </FormField>
                    <FormField label="E-mail">
                      <Input
                        value={guardian.email}
                        onChange={(event) =>
                          updateGuardian(index, { email: event.target.value })
                        }
                      />
                    </FormField>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <CheckboxField
                      label="Responsável principal"
                      checked={guardian.is_primary}
                      onCheckedChange={(is_primary) =>
                        updateGuardian(index, { is_primary })
                      }
                    />
                    {form.guardians.length > 1 && (
                      <Button
                        type="button"
                        variant="destructiveOutline"
                        onClick={() => removeGuardian(index)}
                      >
                        Remover
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
