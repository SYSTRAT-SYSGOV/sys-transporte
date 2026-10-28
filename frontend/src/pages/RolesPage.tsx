import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Permission, Role, RolePayload } from "@/api/types";
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
} from "@sysgov/ui";
import { errorMessage, fieldError } from "@/lib/errors";
import { useArray } from "@/lib/queries";

interface RoleForm extends RolePayload {
  id?: string;
}

const empty: RoleForm = {
  code: "",
  name: "",
  description: null,
  permission_codes: [],
};

export default function RolesPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<RoleForm | null>(null);
  const roles = useArray<Role>("roles", "/identity/roles");
  const permissions = useArray<Permission>(
    "permissions",
    "/identity/permissions",
  );

  const grouped = useMemo(() => {
    const groups = new Map<string, Permission[]>();
    (permissions.data ?? []).forEach((permission) => {
      const [domain, resource] = permission.code.split(".");
      const key = resource ? `${domain}.${resource}` : domain;
      const list = groups.get(key) ?? [];
      list.push(permission);
      groups.set(key, list);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [permissions.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!editing) {
        throw new Error("Papel não selecionado");
      }
      const body = JSON.stringify({
        code: editing.code,
        name: editing.name,
        description: editing.description,
        permission_codes: editing.permission_codes,
      });
      if (editing.id) {
        return api<Role>(`/identity/roles/${editing.id}`, {
          method: "PUT",
          body,
        });
      }
      return api<Role>("/identity/roles", { method: "POST", body });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      setEditing(null);
    },
  });

  const toggle = (code: string) => {
    setEditing((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        permission_codes: current.permission_codes.includes(code)
          ? current.permission_codes.filter((item) => item !== code)
          : [...current.permission_codes, code],
      };
    });
  };

  return (
    <div>
      <PageHeader
        title="Papéis e permissões"
        description="Combine permissões granulares para cada função da equipe."
        actions={
          <Button
            type="button"

            onClick={() => setEditing({ ...empty, permission_codes: [] })}
          >
            Novo papel
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <DataTable
          loading={roles.isLoading}
          rows={roles.data}
          keyOf={(row) => row.id}
          empty="Nenhum papel cadastrado"
          columns={[
            {
              header: "Papel",
              render: (row) => (
                <div>
                  <p className="font-medium text-foreground">{row.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {row.code}
                  </p>
                </div>
              ),
            },
            {
              header: "Permissões",
              render: (row) => (
                <Badge variant="neutral">
                  {row.permissions.length} concedida(s)
                </Badge>
              ),
            },
            {
              header: "Tipo",
              render: (row) =>
                row.is_system ? (
                  <Badge variant="info">Sistema</Badge>
                ) : (
                  <Badge variant="neutral">Personalizado</Badge>
                ),
            },
            {
              header: "",
              className: "text-right",
              render: (row) => (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    setEditing({
                      id: row.id,
                      code: row.code,
                      name: row.name,
                      description: row.description,
                      permission_codes: [...row.permissions],
                    })
                  }
                >
                  Editar
                </Button>
              ),
            },
          ]}
        />
      </Card>

      {editing && (
        <Modal
          title={editing.id ? `Editar papel — ${editing.name}` : "Novo papel"}
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
            <FormField label="Código" error={fieldError(save.error, "code")}>
              <Input
                className="font-mono"
                value={editing.code}
                onChange={(event) =>
                  setEditing({ ...editing, code: event.target.value })
                }
              />
            </FormField>
            <FormField label="Nome" error={fieldError(save.error, "name")}>
              <Input
                value={editing.name}
                onChange={(event) =>
                  setEditing({ ...editing, name: event.target.value })
                }
              />
            </FormField>
            <div className="sm:col-span-2">
              <FormField label="Descrição">
                <Input
                  value={editing.description ?? ""}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      description: event.target.value || null,
                    })
                  }
                />
              </FormField>
            </div>
          </div>

          <div className="mt-4 max-h-[420px] overflow-y-auto rounded-lg border border-border p-3">
            {grouped.map(([group, items]) => (
              <div key={group} className="mb-3">
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {group}
                </p>
                <div className="grid gap-1 sm:grid-cols-2">
                  {items.map((permission) => (
                    <CheckboxField
                      key={permission.code}
                      className="rounded px-1 py-1 hover:bg-accent"
                      label={
                        <span className="font-mono text-xs">
                          {permission.code}
                        </span>
                      }
                      description={permission.description}
                      checked={editing.permission_codes.includes(
                        permission.code,
                      )}
                      onCheckedChange={() => toggle(permission.code)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
