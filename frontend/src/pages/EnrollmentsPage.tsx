import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import {
  AcademicYear,
  Enrollment,
  EnrollmentPayload,
  School,
  SHIFT_LABELS,
  Student,
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
} from "@sysgov/ui";
import { errorMessage, fieldError, useSearch } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { useArray, useOptions, usePagedList } from "@/lib/queries";

const empty: EnrollmentPayload = {
  student_id: "",
  school_id: "",
  academic_year_id: "",
  grade: "",
  shift: "morning",
  has_curricular_attendance: true,
  didactic_mediation: "presencial",
  country: "BR",
  start_date: "",
};

const statusLabels: Record<string, string> = {
  active: "Ativa",
  closed: "Encerrada",
  transferred: "Transferida",
  dropped_out: "Evasão",
  completed: "Concluída",
};

export default function EnrollmentsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const search = useSearch();
  const [yearFilter, setYearFilter] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<EnrollmentPayload>(empty);
  const [closing, setClosing] = useState<Enrollment | null>(null);
  const [closeDate, setCloseDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [closeReason, setCloseReason] = useState("");

  const list = usePagedList<Enrollment>(
    "enrollments",
    "/registry/enrollments",
    {
      page,
      per_page: 20,
      search: search.committed,
      academic_year_id: yearFilter,
      school_id: schoolFilter,
    },
  );
  const years = useArray<AcademicYear>("years", "/registry/academic-years");
  const schools = useOptions<School>("schools", "/registry/schools");
  const students = useOptions<Student>("students", "/registry/students");

  const create = useMutation({
    mutationFn: () =>
      api<Enrollment>("/registry/enrollments", {
        method: "POST",
        body: JSON.stringify(form),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setCreating(false);
    },
  });

  const close = useMutation({
    mutationFn: () =>
      api<Enrollment>(`/registry/enrollments/${closing?.id}/close`, {
        method: "POST",
        body: JSON.stringify({
          end_date: closeDate,
          reason: closeReason || null,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["allocations"] });
      setClosing(null);
    },
  });

  const canManage = hasPermission("registry.enrollment.manage");

  const openNew = () => {
    setForm({
      ...empty,
      school_id: schools.data?.items[0]?.id ?? "",
      academic_year_id: years.data?.find((year) => year.is_active)?.id ?? "",
      start_date: new Date().toISOString().slice(0, 10),
    });
    setCreating(true);
  };

  return (
    <div>
      <PageHeader
        title="Matrículas"
        description="Vínculo entre aluno, escola e ano letivo, com encerramento rastreável."
        actions={
          canManage && (
            <Button type="button" onClick={openNew}>
              Nova matrícula
            </Button>
          )
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchBar
          value={search.input}
          onChange={search.setInput}
          onSubmit={() => {
            setPage(1);
            search.submit();
          }}
          placeholder="Buscar por aluno"
        />
        <NativeSelect
          className="max-w-[220px]"
          value={yearFilter}
          onChange={(event) => {
            setPage(1);
            setYearFilter(event.target.value);
          }}
        >
          <option value="">Todos os anos</option>
          {years.data?.map((year) => (
            <option key={year.id} value={year.id}>
              {year.year}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          className="max-w-[260px]"
          value={schoolFilter}
          onChange={(event) => {
            setPage(1);
            setSchoolFilter(event.target.value);
          }}
        >
          <option value="">Todas as escolas</option>
          {schools.data?.items.map((school) => (
            <option key={school.id} value={school.id}>
              {school.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      <Card className="overflow-hidden">
        <DataTable
          loading={list.isLoading}
          rows={list.data?.items}
          keyOf={(row) => row.id}
          empty="Nenhuma matrícula encontrada"
          columns={[
            {
              header: "Aluno",
              render: (row) => (
                <div>
                  <p className="font-medium text-foreground">
                    {row.student_name}
                  </p>
                  <p className="text-xs text-muted-foreground">{row.grade}</p>
                </div>
              ),
            },
            { header: "Escola", render: (row) => row.school_name },
            {
              header: "Ano",
              render: (row) => (
                <span className="font-mono">{row.academic_year}</span>
              ),
            },
            {
              header: "Turno",
              render: (row) => SHIFT_LABELS[row.shift] ?? row.shift,
            },
            {
              header: "Período",
              render: (row) => (
                <span className="font-mono text-xs text-gov-text-secondary">
                  {formatDate(row.start_date)} —{" "}
                  {row.end_date ? formatDate(row.end_date) : "atual"}
                </span>
              ),
            },
            {
              header: "Situação",
              render: (row) => (
                <Badge
                  variant={row.status === "active" ? "success" : "neutral"}
                >
                  {statusLabels[row.status] ?? row.status}
                </Badge>
              ),
            },
            {
              header: "",
              className: "text-right",
              render: (row) =>
                canManage &&
                row.status === "active" && (
                  <Button
                    type="button"
                    variant="destructiveOutline"
                    onClick={() => {
                      setClosing(row);
                      setCloseDate(new Date().toISOString().slice(0, 10));
                      setCloseReason("");
                    }}
                  >
                    Encerrar
                  </Button>
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

      {creating && (
        <Modal
          title="Nova matrícula"
          onClose={() => setCreating(false)}
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreating(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"

                onClick={() => create.mutate()}
                disabled={create.isPending}
              >
                {create.isPending ? "Salvando…" : "Matricular"}
              </Button>
            </>
          }
        >
          <ErrorBanner message={errorMessage(create.error)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormField
                label="Aluno"
                error={fieldError(create.error, "student_id")}
              >
                <NativeSelect
                  value={form.student_id}
                  onChange={(event) =>
                    setForm({ ...form, student_id: event.target.value })
                  }
                >
                  <option value="">Selecione o aluno</option>
                  {students.data?.items.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.full_name}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            </div>
            <FormField
              label="Escola"
              error={fieldError(create.error, "school_id")}
            >
              <NativeSelect
                value={form.school_id}
                onChange={(event) =>
                  setForm({ ...form, school_id: event.target.value })
                }
              >
                <option value="">Selecione a escola</option>
                {schools.data?.items.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField
              label="Ano letivo"
              error={fieldError(create.error, "academic_year_id")}
            >
              <NativeSelect
                value={form.academic_year_id}
                onChange={(event) =>
                  setForm({ ...form, academic_year_id: event.target.value })
                }
              >
                <option value="">Selecione o ano letivo</option>
                {years.data?.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.year}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField
              label="Série/ano"
              error={fieldError(create.error, "grade")}
            >
              <Input
                value={form.grade}
                placeholder="Ex.: 5º ano"
                onChange={(event) =>
                  setForm({ ...form, grade: event.target.value })
                }
              />
            </FormField>
            <FormField label="Turno">
              <NativeSelect
                value={form.shift}
                onChange={(event) =>
                  setForm({ ...form, shift: event.target.value })
                }
              >
                {Object.entries(SHIFT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Mediação didática">
              <NativeSelect
                value={form.didactic_mediation}
                onChange={(event) =>
                  setForm({ ...form, didactic_mediation: event.target.value })
                }
              >
                <option value="presencial">Presencial</option>
                <option value="semipresencial">Semipresencial</option>
                <option value="distancia">A distância</option>
              </NativeSelect>
            </FormField>
            <FormField label="País de residência">
              <Input
                maxLength={2}
                value={form.country}
                onChange={(event) =>
                  setForm({
                    ...form,
                    country: event.target.value.toUpperCase(),
                  })
                }
              />
            </FormField>
            <CheckboxField
              label="Turma com atendimento curricular"
              checked={form.has_curricular_attendance}
              onCheckedChange={(has_curricular_attendance) =>
                setForm({ ...form, has_curricular_attendance })
              }
            />
            <FormField
              label="Início"
              error={fieldError(create.error, "start_date")}
            >
              <Input
                type="date"

                value={form.start_date}
                onChange={(event) =>
                  setForm({ ...form, start_date: event.target.value })
                }
              />
            </FormField>
          </div>
        </Modal>
      )}

      {closing && (
        <Modal
          title={`Encerrar matrícula — ${closing.student_name}`}
          onClose={() => setClosing(null)}
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setClosing(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructiveOutline"
                onClick={() => close.mutate()}
                disabled={close.isPending}
              >
                {close.isPending ? "Encerrando…" : "Encerrar matrícula"}
              </Button>
            </>
          }
        >
          <ErrorBanner message={errorMessage(close.error)} />
          <p className="mb-4 rounded-lg border border-warning-border bg-warning-surface px-3 py-2 text-xs text-warning-strong">
            O encerramento também finaliza as alocações de transporte
            vinculadas.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              label="Data de encerramento"
              error={fieldError(close.error, "end_date")}
            >
              <Input
                type="date"

                value={closeDate}
                onChange={(event) => setCloseDate(event.target.value)}
              />
            </FormField>
            <FormField label="Motivo">
              <Input
                value={closeReason}
                onChange={(event) => setCloseReason(event.target.value)}
              />
            </FormField>
          </div>
        </Modal>
      )}
    </div>
  );
}
