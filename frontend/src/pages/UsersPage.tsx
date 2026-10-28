import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Role, User } from "@/api/types";
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
} from "@sysgov/ui";
import { errorMessage, fieldError, useSearch } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { useArray, usePagedList } from "@/lib/queries";

interface UserForm {
  full_name: string;
  email: string;
  password: string;
  is_active: boolean;
  role_ids: string[];
}

const empty: UserForm = {
  full_name: "",
  email: "",
  password: "",
  is_active: true,
  role_ids: [],
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const search = useSearch();
  const [editing, setEditing] = useState<User | "new" | null>(null);
  const [form, setForm] = useState<UserForm>(empty);
  const [resetting, setResetting] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const list = usePagedList<User>("users", "/identity/users", {
    page,
    per_page: 20,
    search: search.committed,
  });
  const roles = useArray<Role>("roles", "/identity/roles");

  const save = useMutation({
    mutationFn: async () => {
      if (editing === "new") {
        return api<User>("/identity/users", {
          method: "POST",
          body: JSON.stringify({
            full_name: form.full_name,
            email: form.email,
            password: form.password,
            role_ids: form.role_ids,
          }),
        });
      }
      return api<User>(`/identity/users/${(editing as User).id}`, {
        method: "PUT",
        body: JSON.stringify({
          full_name: form.full_name,
          email: form.email,
          is_active: form.is_active,
          role_ids: form.role_ids,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditing(null);
    },
  });

  const unlock = useMutation({
    mutationFn: (id: string) =>
      api(`/identity/users/${id}/unlock`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  const resetPassword = useMutation({
    mutationFn: () =>
      api(`/identity/users/${resetting?.id}/password`, {
        method: "POST",
        body: JSON.stringify({ password: newPassword }),
      }),
    onSuccess: () => {
      setResetting(null);
      setNewPassword("");
    },
  });

  const openNew = () => {
    setForm(empty);
    setEditing("new");
  };

  const openEdit = (user: User) => {
    setForm({
      full_name: user.full_name,
      email: user.email,
      password: "",
      is_active: user.is_active,
      role_ids: user.roles.map((role) => role.id),
    });
    setEditing(user);
  };

  const toggleRole = (roleId: string) => {
    setForm((current) => ({
      ...current,
      role_ids: current.role_ids.includes(roleId)
        ? current.role_ids.filter((id) => id !== roleId)
        : [...current.role_ids, roleId],
    }));
  };

  const isLocked = (user: User) =>
    Boolean(
      user.locked_until && new Date(user.locked_until).getTime() > Date.now(),
    );

  return (
    <div>
      <PageHeader
        title="Usuários"
        description="Contas de acesso, papéis e bloqueio por tentativas inválidas."
        actions={
          <Button type="button" onClick={openNew}>
            Novo usuário
          </Button>
        }
      />

      <div className="mb-3">
        <SearchBar
          value={search.input}
          onChange={search.setInput}
          onSubmit={search.submit}
          placeholder="Buscar por nome ou e-mail"
        />
      </div>

      <Card className="overflow-hidden">
        <DataTable
          loading={list.isLoading}
          rows={list.data?.items}
          keyOf={(row) => row.id}
          empty="Nenhum usuário encontrado"
          columns={[
            {
              header: "Usuário",
              render: (row) => (
                <div>
                  <p className="font-medium text-foreground">{row.full_name}</p>
                  <p className="text-xs text-muted-foreground">{row.email}</p>
                </div>
              ),
            },
            {
              header: "Papéis",
              render: (row) => (
                <div className="flex flex-wrap gap-1">
                  {row.roles.map((role) => (
                    <Badge variant="info">{role.name}</Badge>
                  ))}
                </div>
              ),
            },
            {
              header: "Situação",
              render: (row) =>
                isLocked(row) ? (
                  <Badge variant="critical">Bloqueado</Badge>
                ) : (
                  <Badge variant={row.is_active ? "success" : "neutral"}>
                    {row.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                ),
            },
            {
              header: "Último acesso",
              render: (row) => (
                <span className="font-mono text-xs text-gov-text-secondary">
                  {formatDateTime(row.last_login_at)}
                </span>
              ),
            },
            {
              header: "",
              className: "text-right",
              render: (row) => (
                <div className="flex justify-end gap-1">
                  {isLocked(row) && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => unlock.mutate(row.id)}
                    >
                      Desbloquear
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setResetting(row);
                      setNewPassword("");
                    }}
                  >
                    Senha
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => openEdit(row)}
                  >
                    Editar
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
          title={editing === "new" ? "Novo usuário" : "Editar usuário"}
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
            <FormField label="E-mail" error={fieldError(save.error, "email")}>
              <Input
                type="email"

                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
              />
            </FormField>
            {editing === "new" && (
              <FormField
                label="Senha inicial"
                error={fieldError(save.error, "password")}
                hint="Mínimo de 8 caracteres, com letra e número."
              >
                <Input
                  type="password"

                  value={form.password}
                  onChange={(event) =>
                    setForm({ ...form, password: event.target.value })
                  }
                />
              </FormField>
            )}
            <div className="sm:col-span-2">
              <FormField
                label="Papéis"
                error={fieldError(save.error, "role_ids")}
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  {roles.data?.map((role) => (
                    <CheckboxField
                      key={role.id}
                      className="rounded-lg border border-border px-3 py-2"
                      label={role.name}
                      description={
                        <span className="font-mono text-[11px]">
                          {role.code}
                        </span>
                      }
                      checked={form.role_ids.includes(role.id)}
                      onCheckedChange={() => toggleRole(role.id)}
                    />
                  ))}
                </div>
              </FormField>
            </div>
            {editing !== "new" && (
              <CheckboxField
                label="Usuário ativo"
                checked={form.is_active}
                onCheckedChange={(is_active) => setForm({ ...form, is_active })}
              />
            )}
          </div>
        </Modal>
      )}

      {resetting && (
        <Modal
          title={`Redefinir senha — ${resetting.full_name}`}
          onClose={() => setResetting(null)}
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setResetting(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"

                onClick={() => resetPassword.mutate()}
                disabled={resetPassword.isPending || newPassword.length < 8}
              >
                {resetPassword.isPending ? "Redefinindo…" : "Redefinir"}
              </Button>
            </>
          }
        >
          <ErrorBanner message={errorMessage(resetPassword.error)} />
          <FormField
            label="Nova senha"
            error={fieldError(resetPassword.error, "password")}
            hint="Mínimo de 8 caracteres, com letra e número. Todas as sessões são encerradas."
          >
            <Input
              type="password"

              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </FormField>
        </Modal>
      )}
    </div>
  );
}
