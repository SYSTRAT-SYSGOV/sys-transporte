import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, downloadCsv } from "@/api/client";
import { AcademicYear, CensusValidation, PENDENCY_LABELS } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import {
  Badge,
  Button,
  Card,
  DataTable,
  ErrorBanner,
  NativeSelect,
  PageHeader,
  Skeleton,
  StatCard,
} from "@sysgov/ui";
import { useArray } from "@/lib/queries";

export default function CensusPage() {
  const { hasPermission } = useAuth();
  const years = useArray<AcademicYear>("years", "/registry/academic-years");
  const [yearId, setYearId] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    if (!yearId && years.data && years.data.length > 0) {
      const active = years.data.find((year) => year.is_active) ?? years.data[0];
      setYearId(active.id);
    }
  }, [years.data, yearId]);

  const validation = useQuery({
    queryKey: ["census", yearId],
    queryFn: () =>
      api<CensusValidation>(
        `/transport/census/validation?academic_year_id=${yearId}`,
      ),
    enabled: Boolean(yearId),
  });

  const canExport = hasPermission("transport.census.export");

  const handleExport = async () => {
    if (!yearId) {
      return;
    }
    setExporting(true);
    setExportError(null);
    try {
      await downloadCsv(
        `/transport/census/export?academic_year_id=${yearId}`,
        `censo-${validation.data?.year ?? "export"}.csv`,
      );
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : "Falha ao exportar",
      );
    } finally {
      setExporting(false);
    }
  };

  const data = validation.data;

  return (
    <div>
      <PageHeader
        title="Censo escolar — Registro 60"
        description="Validação das informações de transporte antes da exportação do censo."
        actions={
          <div className="flex items-center gap-2">
            <NativeSelect
              className="max-w-[200px]"
              value={yearId}
              onChange={(event) => setYearId(event.target.value)}
            >
              <option value="">Selecione o ano</option>
              {years.data?.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.year}
                </option>
              ))}
            </NativeSelect>
            {canExport && (
              <Button
                type="button"

                onClick={() => void handleExport()}
                disabled={!yearId || exporting}
              >
                {exporting ? "Exportando…" : "Exportar CSV"}
              </Button>
            )}
          </div>
        }
      />

      <ErrorBanner message={exportError} />

      {validation.isLoading && <Skeleton className="h-40 w-full" />}

      <ErrorBanner
        message={
          validation.isError
            ? "Não foi possível validar o ano selecionado."
            : null
        }
      />

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Ano letivo" value={data.year} />
            <StatCard label="Estudantes ativos" value={data.total_students} />
            <StatCard
              label="Situação"
              value={
                <Badge variant={data.approved ? "success" : "critical"}>
                  {data.approved
                    ? "Apto para exportação"
                    : "Pendências encontradas"}
                </Badge>
              }
              hint={`${data.pendencies.length} pendência(s)`}
            />
          </div>

          <Card className="mt-5 overflow-hidden">
            <header className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">
                Pendências
              </h2>
              <p className="text-xs text-muted-foreground">
                Corrija as inconsistências para liberar a exportação do Registro
                60.
              </p>
            </header>
            <DataTable
              rows={data.pendencies}
              keyOf={(row) => `${row.enrollment_id}-${row.kind}`}
              empty="Nenhuma pendência encontrada."
              columns={[
                {
                  header: "Aluno",
                  render: (row) => (
                    <div>
                      <p className="font-medium text-foreground">
                        {row.student_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {row.school_name}
                      </p>
                    </div>
                  ),
                },
                {
                  header: "Pendência",
                  render: (row) => (
                    <Badge variant="warning">
                      {PENDENCY_LABELS[row.kind] ?? row.kind}
                    </Badge>
                  ),
                },
                { header: "Detalhe", render: (row) => row.detail },
              ]}
            />
          </Card>
        </>
      )}
    </div>
  );
}
