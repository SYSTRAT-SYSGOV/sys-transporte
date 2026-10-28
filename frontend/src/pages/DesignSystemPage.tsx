import { useState } from "react";
import {
  Bus,
  CircleAlert,
  CircleCheck,
  Download,
  GraduationCap,
  Info,
  Plus,
  Route as RouteIcon,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CheckboxField,
  DataTable,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  ErrorBanner,
  FormField,
  Input,
  Modal,
  MonoValue,
  NativeSelect,
  PageHeader,
  Pagination,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Progress,
  SectionCard,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  StatCard,
  StatusBadge,
  SwitchField,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Toolbar,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useConfirm,
  type Column,
} from "@sysgov/ui";

const colorTokens = [
  {
    name: "Primary (GOV.BR)",
    token: "--primary",
    className: "bg-primary",
  },
  { name: "Success", token: "--success", className: "bg-success" },
  { name: "Warning", token: "--warning", className: "bg-warning" },
  { name: "Critical", token: "--critical", className: "bg-critical" },
  { name: "Info GOV.BR", token: "--info", className: "bg-info" },
  { name: "Gov primary", token: "--gov-primary", className: "bg-gov-primary" },
  {
    name: "Gov primary dark",
    token: "--gov-primary-hover",
    className: "bg-gov-primary-hover",
  },
  {
    name: "Gov primary light",
    token: "--gov-primary-light",
    className: "bg-gov-primary-light border border-gov-primary-border",
  },
  {
    name: "Gov page",
    token: "--gov-page",
    className: "bg-gov-page border border-border",
  },
  {
    name: "Sidebar (branca)",
    token: "--sidebar",
    className: "bg-sidebar border border-border",
  },
  {
    name: "Sidebar accent",
    token: "--sidebar-accent",
    className: "bg-sidebar-accent",
  },
  {
    name: "Muted",
    token: "--muted",
    className: "bg-muted border border-border",
  },
];

interface DemoVehicle {
  plate: string;
  driver: string;
  occupancy: number;
  situation: "success" | "warning" | "critical";
}

const demoRows: DemoVehicle[] = [
  {
    plate: "ABC1D23",
    driver: "Maria Souza",
    occupancy: 92,
    situation: "warning",
  },
  {
    plate: "XYZ4E56",
    driver: "João Lima",
    occupancy: 118,
    situation: "critical",
  },
  {
    plate: "QRS7F89",
    driver: "Ana Ribeiro",
    occupancy: 64,
    situation: "success",
  },
];

const demoColumns: Column<DemoVehicle>[] = [
  { header: "Placa", render: (row) => <MonoValue>{row.plate}</MonoValue> },
  { header: "Condutor", render: (row) => row.driver },
  {
    header: "Ocupação",
    numeric: true,
    render: (row) => `${row.occupancy}%`,
  },
  {
    header: "Situação",
    render: (row) => (
      <StatusBadge tone={row.situation}>
        {row.situation === "success"
          ? "Regular"
          : row.situation === "warning"
            ? "Atenção"
            : "Crítico"}
      </StatusBadge>
    ),
  },
];

function TokenCard({
  name,
  token,
  className,
}: {
  name: string;
  token: string;
  className: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className={`h-10 rounded-md ${className}`} aria-hidden />
      <p className="mt-2 text-xs font-semibold text-gov-text-secondary">
        {name}
      </p>
      <p className="font-mono text-[11px] text-muted-foreground">{token}</p>
    </div>
  );
}

export default function DesignSystemPage() {
  const confirm = useConfirm();
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [active, setActive] = useState(true);
  const [notify, setNotify] = useState(true);

  const handleConfirm = async () => {
    const ok = await confirm({
      title: "Inativar o veículo ABC1D23?",
      description:
        "O veículo deixa de ser elegível para novas rotas e mantém o histórico de vistorias.",
      confirmLabel: "Inativar",
      destructive: true,
    });
    if (ok) {
      toast.success("Confirmação aceita.");
    } else {
      toast.info("Ação cancelada.");
    }
  };

  return (
    <div>
      <PageHeader
        title="Design system SYSGOV"
        description="Tokens GOV.BR, sidebar branca do web-client, primitivas shadcn/ui e componentes de aplicação do console de transporte escolar."
        actions={
          <Badge variant="success" className="h-6">
            @sysgov/ui
          </Badge>
        }
      />

      <div className="space-y-6">
        <SectionCard
          title="Tokens"
          description="Cores, tipografia e raios definidos em src/index.css e consumidos por classes utilitárias."
          contentClassName="space-y-6 p-5"
        >
          <div>
            <h3 className="mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">
              Cores
            </h3>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {colorTokens.map((color) => (
                <TokenCard key={color.token} {...color} />
              ))}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div>
              <h3 className="mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">
                Tipografia
              </h3>
              <p className="font-sans text-lg font-semibold text-foreground">
                Inter — texto institucional
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Corpo em 14px, títulos com tracking negativo e hierarquia por
                peso, não por cor.
              </p>
              <p className="mt-3 font-mono text-sm text-foreground">
                JetBrains Mono — 19,75 km · ABC1D23 · 50%
              </p>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">
                Raios
              </h3>
              <div className="flex items-end gap-3">
                <div className="flex size-14 items-center justify-center rounded-sm border border-border bg-muted font-mono text-[11px]">
                  sm
                </div>
                <div className="flex size-14 items-center justify-center rounded-md border border-border bg-muted font-mono text-[11px]">
                  md
                </div>
                <div className="flex size-14 items-center justify-center rounded-lg border border-border bg-muted font-mono text-[11px]">
                  lg
                </div>
                <div className="flex size-14 items-center justify-center rounded-xl border border-border bg-muted font-mono text-[11px]">
                  xl
                </div>
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">
                Status
              </h3>
              <div className="flex flex-wrap gap-2">
                <StatusBadge tone="success">Regular</StatusBadge>
                <StatusBadge tone="warning">Atenção</StatusBadge>
                <StatusBadge tone="critical">Crítico</StatusBadge>
                <StatusBadge tone="info">Informativo</StatusBadge>
                <StatusBadge tone="neutral">Inativo</StatusBadge>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Componentes"
          description="Primitivas shadcn/ui em @sysgov/ui, com a camada de aplicação do SYSGOV."
          contentClassName="p-5"
        >
          <Tabs defaultValue="acoes">
            <TabsList>
              <TabsTrigger value="acoes">Ações</TabsTrigger>
              <TabsTrigger value="formularios">Formulários</TabsTrigger>
              <TabsTrigger value="dados">Dados</TabsTrigger>
              <TabsTrigger value="feedback">Feedback</TabsTrigger>
              <TabsTrigger value="sobreposicoes">Sobreposições</TabsTrigger>
            </TabsList>

            <TabsContent value="acoes" className="pt-5">
              <div className="space-y-6">
                <div>
                  <h3 className="mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">
                    Variantes
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <Button>Primário</Button>
                    <Button variant="success">Sucesso</Button>
                    <Button variant="secondary">Secundário</Button>
                    <Button variant="outline">Contorno</Button>
                    <Button variant="ghost">Fantasma</Button>
                    <Button variant="destructive">Destrutivo</Button>
                    <Button variant="destructiveOutline">
                      Destrutivo suave
                    </Button>
                    <Button variant="link">Link</Button>
                  </div>
                </div>
                <div>
                  <h3 className="mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">
                    Tamanhos e ícones
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm">
                      <Plus />
                      Pequeno
                    </Button>
                    <Button>
                      <Download />
                      Padrão
                    </Button>
                    <Button size="lg">Grande</Button>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="outline"
                          aria-label="Adicionar"
                        >
                          <Plus />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Adicionar registro</TooltipContent>
                    </Tooltip>
                    <Button size="iconSm" variant="ghost" aria-label="Baixar">
                      <Download />
                    </Button>
                  </div>
                </div>
                <div>
                  <h3 className="mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">
                    Badges
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <Badge>Padrão</Badge>
                    <Badge variant="secondary">Secundário</Badge>
                    <Badge variant="outline">Contorno</Badge>
                    <Badge variant="success">Ativo</Badge>
                    <Badge variant="warning">A vencer</Badge>
                    <Badge variant="critical">Vencido</Badge>
                    <Badge variant="info">Censo</Badge>
                    <Badge variant="neutral">Inativo</Badge>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="formularios" className="pt-5">
              <div className="grid gap-4 lg:grid-cols-2">
                <FormField label="Nome da escola" hint="Como aparece no Censo">
                  <Input placeholder="EMEF Centro" />
                </FormField>
                <FormField
                  label="Código INEP"
                  error="Código já cadastrado em outra escola"
                >
                  <Input defaultValue="35012345" aria-invalid />
                </FormField>
                <FormField label="Rede de ensino">
                  <NativeSelect defaultValue="municipal">
                    <option value="municipal">Municipal</option>
                    <option value="estadual">Estadual</option>
                    <option value="federal">Federal</option>
                  </NativeSelect>
                </FormField>
                <FormField label="Turno (Select shadcn)">
                  <Select defaultValue="morning">
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o turno" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="morning">Manhã</SelectItem>
                      <SelectItem value="afternoon">Tarde</SelectItem>
                      <SelectItem value="evening">Noite</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
                <div className="lg:col-span-2">
                  <FormField label="Observações">
                    <Textarea
                      rows={3}
                      placeholder="Informações complementares do itinerário"
                    />
                  </FormField>
                </div>
                <CheckboxField
                  label="Escola ativa"
                  description="Inativas saem das listagens padrão e permanecem no histórico."
                  checked={active}
                  onCheckedChange={setActive}
                />
                <SwitchField
                  label="Notificações de vencimento"
                  description="Avisa CNH, curso e vistoria a vencer em 30 dias."
                  checked={notify}
                  onCheckedChange={setNotify}
                />
              </div>
            </TabsContent>

            <TabsContent value="dados" className="space-y-5 pt-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard
                  label="Rotas ativas"
                  value="18"
                  hint="Todas com motorista elegível"
                  icon={<RouteIcon />}
                />
                <StatCard
                  label="Alunos alocados"
                  value="642"
                  hint="Ocupação média de 71%"
                  icon={<GraduationCap />}
                  accent="info"
                />
                <StatCard
                  label="Vistorias vencidas"
                  value="2"
                  hint="Bloqueiam novas alocações"
                  icon={<Bus />}
                  accent="critical"
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Semáforo de lotação</CardTitle>
                  <CardDescription>
                    Verde até 80%, amarelo acima de 80% e vermelho acima de
                    100%.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span>Rota Centro — 32/40</span>
                      <MonoValue>80%</MonoValue>
                    </div>
                    <Progress value={80} tone="ok" label="Ocupação 80%" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span>Rota Rural — 37/40</span>
                      <MonoValue>92%</MonoValue>
                    </div>
                    <Progress value={92} tone="warning" label="Ocupação 92%" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span>Rota Norte — 47/40</span>
                      <MonoValue>118%</MonoValue>
                    </div>
                    <Progress
                      value={100}
                      tone="critical"
                      label="Ocupação 118%"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="overflow-hidden">
                <Toolbar className="mb-0 border-b border-border px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Frota</Badge>
                    <span className="text-xs text-muted-foreground">
                      Exemplo de DataTable com ordenação numérica e status
                    </span>
                  </div>
                  <Button size="sm" variant="outline">
                    Exportar
                  </Button>
                </Toolbar>
                <DataTable
                  columns={demoColumns}
                  rows={demoRows}
                  keyOf={(row) => row.plate}
                />
                <Pagination
                  page={page}
                  perPage={10}
                  total={24}
                  onPage={setPage}
                />
              </Card>

              <EmptyState
                title="Nenhuma pendência no Censo"
                description="Todos os alunos alocados possuem escola, rota e veículo consistentes."
              />
            </TabsContent>

            <TabsContent value="feedback" className="space-y-4 pt-5">
              <ErrorBanner message="O código INEP informado já pertence a outra escola." />
              <Alert>
                <Info />
                <AlertTitle>Informação</AlertTitle>
                <AlertDescription>
                  A pré-validação do Censo pode ser executada quantas vezes for
                  necessário.
                </AlertDescription>
              </Alert>
              <Alert variant="success">
                <CircleCheck />
                <AlertTitle>Vistoria registrada</AlertTitle>
                <AlertDescription>
                  O veículo ABC1D23 passa a ser o vigente no histórico.
                </AlertDescription>
              </Alert>
              <Alert variant="warning">
                <TriangleAlert />
                <AlertTitle>CNH a vencer</AlertTitle>
                <AlertDescription>
                  A habilitação vence em 15 dias; o vínculo a novas rotas será
                  bloqueado após o vencimento.
                </AlertDescription>
              </Alert>
              <Alert variant="destructive">
                <CircleAlert />
                <AlertTitle>Capacidade excedida</AlertTitle>
                <AlertDescription>
                  A rota já atingiu 40 alunos. Use a exceção auditada ou escolha
                  outro veículo.
                </AlertDescription>
              </Alert>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    toast.success("Vistoria registrada com sucesso.")
                  }
                >
                  Notificação de sucesso
                </Button>
                <Button
                  variant="outline"
                  onClick={() => toast.info("Exportação do Censo iniciada.")}
                >
                  Notificação informativa
                </Button>
                <Button
                  variant="outline"
                  onClick={() => toast.error("Falha ao salvar a alocação.")}
                >
                  Notificação de erro
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <Progress value={42} tone="neutral" className="max-w-48" />
                  Carregando dados da rota…
                </div>
              </div>
            </TabsContent>

            <TabsContent value="sobreposicoes" className="pt-5">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(true)}>
                  Abrir diálogo
                </Button>
                <Button variant="outline" onClick={() => void handleConfirm()}>
                  Confirmar ação destrutiva
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline">Popover</Button>
                  </PopoverTrigger>
                  <PopoverContent>
                    <p className="text-sm font-semibold">Filtros salvos</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Reaplique a combinação de ano, escola e turno usada na
                      última consulta.
                    </p>
                  </PopoverContent>
                </Popover>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">Menu de ações</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuLabel>Rota Centro</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>Editar rota</DropdownMenuItem>
                    <DropdownMenuItem>Exportar itinerário</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive">
                      Inativar rota
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </TabsContent>
          </Tabs>
        </SectionCard>

        <SectionCard
          title="Regras de uso"
          description="Convenções obrigatórias para manter o console consistente."
          contentClassName="p-5"
        >
          <ul className="grid list-disc gap-2 pl-5 text-sm text-muted-foreground lg:grid-cols-2">
            <li>
              Reutilize os componentes de <MonoValue>@sysgov/ui</MonoValue>{" "}
              antes de criar marcação nova.
            </li>
            <li>
              Não use CSS inline, emojis ou SVGs soltos; ícones vêm de{" "}
              <MonoValue>lucide-react</MonoValue>.
            </li>
            <li>
              Todo dado técnico (placa, documento, data, métrica) usa{" "}
              <MonoValue>MonoValue</MonoValue>.
            </li>
            <li>
              Confirmações usam <MonoValue>useConfirm</MonoValue>; avisos usam{" "}
              <MonoValue>toast</MonoValue>.
            </li>
            <li>
              Formulários usam <MonoValue>FormField</MonoValue>, que liga
              rótulo, erro e <MonoValue>aria-describedby</MonoValue>.
            </li>
            <li>
              Estados de tela sempre contemplam carregamento, vazio e erro.
            </li>
          </ul>
        </SectionCard>
      </div>

      {dialogOpen && (
        <Modal
          title="Detalhes da vistoria"
          onClose={() => setDialogOpen(false)}
          footer={
            <Button type="button" onClick={() => setDialogOpen(false)}>
              Fechar
            </Button>
          }
        >
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Veículo</dt>
              <dd className="font-mono font-semibold">ABC1D23</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Certificado</dt>
              <dd className="font-mono font-semibold">DETRAN-2026-001</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Validade</dt>
              <dd className="font-mono font-semibold">31/12/2026</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Situação</dt>
              <dd>
                <StatusBadge tone="success">Regular</StatusBadge>
              </dd>
            </div>
          </dl>
        </Modal>
      )}
    </div>
  );
}
