import { useState } from "react";
import { AuditEvent, Page } from "@/api/types";
import {
  Badge,
  Card,
  DataTable,
  Input,
  Label,
  NativeSelect,
  PageHeader,
  Pagination,
} from "@sysgov/ui";
import { formatDateTime } from "@/lib/format";
import { usePagedList } from "@/lib/queries";

const resources = [
  "identity.user",
  "identity.role",
  "identity.auth",
  "registry.school",
  "registry.student",
  "registry.enrollment",
  "transport.company",
  "transport.driver",
  "transport.vehicle",
  "transport.inspection",
  "transport.stop",
  "transport.route",
  "transport.allocation",
  "transport.census",
];

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [resource, setResource] = useState("");

  const list = usePagedList<AuditEvent>("audit", "/identity/audit", {
    page,
    per_page: 25,
    from,
    to,
    resource,
  });

  const data = list.data as Page<AuditEvent> | undefined;

  return (
    <div>
      <PageHeader
        title="Auditoria"
        description="Trilha imutável de operações: quem alterou, quando, de onde e o que mudou."
      />

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div>
          <Label className="mb-1 block" htmlFor="audit-from">
            De
          </Label>
          <Input
            id="audit-from"
            type="date"

            value={from}
            onChange={(event) => {
              setPage(1);
              setFrom(event.target.value);
            }}
          />
        </div>
        <div>
          <Label className="mb-1 block" htmlFor="audit-to">
            Até
          </Label>
          <Input
            id="audit-to"
            type="date"

            value={to}
            onChange={(event) => {
              setPage(1);
              setTo(event.target.value);
            }}
          />
        </div>
        <div className="min-w-[240px]">
          <Label className="mb-1 block" htmlFor="audit-resource">
            Recurso
          </Label>
          <NativeSelect
            id="audit-resource"

            value={resource}
            onChange={(event) => {
              setPage(1);
              setResource(event.target.value);
            }}
          >
            <option value="">Todos</option>
            {resources.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <Card className="overflow-hidden">
        <DataTable
          loading={list.isLoading}
          rows={data?.items}
          keyOf={(row) => row.id}
          empty="Nenhum evento de auditoria no período"
          columns={[
            {
              header: "Quando",
              render: (row) => (
                <span className="font-mono text-xs text-gov-text-secondary">
                  {formatDateTime(row.created_at)}
                </span>
              ),
            },
            {
              header: "Ator",
              render: (row) => (
                <span className="text-xs text-foreground">
                  {row.actor_email ?? "sistema"}
                </span>
              ),
            },
            {
              header: "Ação",
              render: (row) => (
                <span className="font-mono text-xs">{row.action}</span>
              ),
            },
            {
              header: "Recurso",
              render: (row) => (
                <div className="text-xs">
                  <p className="font-mono text-foreground">{row.resource}</p>
                  <p className="text-gov-text-muted">
                    {row.resource_id ?? "—"}
                  </p>
                </div>
              ),
            },
            {
              header: "Resultado",
              render: (row) => (
                <Badge
                  variant={row.result === "success" ? "success" : "critical"}
                >
                  {row.result}
                </Badge>
              ),
            },
            {
              header: "Detalhes",
              render: (row) =>
                row.before_data || row.after_data ? (
                  <details className="text-xs">
                    <summary className="cursor-pointer font-semibold text-gov-blue">
                      Ver alterações
                    </summary>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div>
                        <p className="mb-1 font-semibold text-gov-text-secondary">
                          Antes
                        </p>
                        <pre className="max-h-48 overflow-auto rounded bg-muted/50 p-2 font-mono text-[11px]">
                          {row.before_data
                            ? JSON.stringify(row.before_data, null, 2)
                            : "—"}
                        </pre>
                      </div>
                      <div>
                        <p className="mb-1 font-semibold text-gov-text-secondary">
                          Depois
                        </p>
                        <pre className="max-h-48 overflow-auto rounded bg-muted/50 p-2 font-mono text-[11px]">
                          {row.after_data
                            ? JSON.stringify(row.after_data, null, 2)
                            : "—"}
                        </pre>
                      </div>
                    </div>
                  </details>
                ) : (
                  <span className="text-xs text-gov-text-muted">—</span>
                ),
            },
          ]}
        />
        {data && (
          <Pagination
            page={data.page}
            perPage={data.per_page}
            total={data.total}
            onPage={setPage}
          />
        )}
      </Card>
    </div>
  );
}
