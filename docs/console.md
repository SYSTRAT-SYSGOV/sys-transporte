# Console web

Aplicação React 19 + Vite + TanStack Query + Tailwind + Leaflet, servida pelo
nginx em `http://localhost:8080` (Docker) ou `http://localhost:5173` (`npm run dev`).
A interface usa **shadcn/ui** sobre Radix UI e segue o **Design System SYSGOV**.

## Acesso

1. Abra o console e informe e-mail e senha.
2. A sessão usa access token de 15 minutos e refresh de 7 dias com rotação
   automática: ao receber `401`, o cliente renova o token e repete a requisição.
3. Após 5 tentativas inválidas a conta fica bloqueada por 15 minutos; o
   administrador pode desbloquear em **Usuários → Desbloquear**.

O menu é montado conforme as permissões do usuário. Rotas sem permissão exibem
“Acesso restrito”.

## Telas

### Painel

- Contadores de escolas, estudantes, rotas, veículos, motoristas e alocações.
- **Lotação por rota** com semáforo: verde até 80%, amarelo acima de 80% e
  vermelho acima de 100%.
- **Alertas de conformidade** de CNH, curso, toxicológico e vistoria (30 dias).

### Cadastros

- **Escolas**: código INEP único, rede de ensino, município/UF.
- **Alunos**: dados pessoais e responsáveis legais (ao menos um).
- **Matrículas**: aluno + escola + ano letivo; encerramento com data e motivo,
  encerrando também as alocações.

Conflitos (`409`) aparecem em faixa vermelha no formulário; erros por campo são
exibidos abaixo do respectivo input.

### Frota

- **Empresas**: contrato com vigência; badge “Vencido” quando expirado.
- **Motoristas**: CNH, curso e toxicológico com validade; impedimentos listados
  na coluna “Conformidade”.
- **Veículos**: capacidade, tipologia Inep, acessibilidade e vistoria vigente.
  O botão **Vistorias** abre o histórico e permite registrar nova vistoria.
- **Paradas**: latitude/longitude válidas e mapa com todos os pontos.

### Rotas

- Lista com filtros por ano, turno, tipo e situação, além da lotação.
- **Nova rota / Editar**: escola, ano letivo, empresa, veículo, motorista,
  quilometragem e horários.
- **Alunos** abre o editor da rota:
  - mapa Leaflet com paradas numeradas e linha do itinerário;
  - reordenação do itinerário (↑/↓), horários de embarque/desembarque e
    gravação da sequência;
  - painel de alunos alocados, com filtro de encerradas e indicador de capacidade;
  - ao atingir o limite, o diálogo exige justificativa e só permite prosseguir
    para quem possui `transport.allocation.override_capacity`.

### Censo escolar

- Selecione o ano letivo para ver total de estudantes, situação e pendências
  (`sem_alocacao_ativa`, `rota_sem_veiculo`, `rural_sem_declaracao`,
  `veiculo_nao_adaptado`).
- **Exportar CSV** baixa `censo-transporte-<ano>.csv` com cabeçalho estável.

### Administração

- **Usuários**: criação, papéis, desbloqueio e redefinição de senha (encerra as
  sessões do usuário).
- **Papéis**: permissões agrupadas por recurso; papéis de sistema identificados.
- **Auditoria**: filtros por período e recurso, com visualização do diff
  “antes/depois” de cada evento. A trilha é somente leitura.

## Design system

O guia completo está em [`design-system.md`](design-system.md); a referência
visual fica em **Administração → Design system** (`/design-system`).

- **Componentes**: primitivas shadcn/ui em `frontend/src/components/ui/`
  (Button, Input, Textarea, NativeSelect, Select, Checkbox, Switch, Card, Badge,
  Dialog, Sheet, DropdownMenu, Popover, Tabs, Table, Tooltip, Avatar, ScrollArea,
  Alert, Skeleton, Progress e Sonner).
- **Camada de aplicação**: `frontend/src/components/ui/app.tsx` expõe
  `PageHeader`, `StatCard`, `SectionCard`, `DataTable`, `Pagination`,
  `FormField`, `SearchBar`, `Toolbar`, `ErrorBanner`, `EmptyState`,
  `StatusBadge`, `MonoValue`, `CheckboxField`, `SwitchField` e
  `ConfirmProvider`/`useConfirm`.
- **Layout**: App Shell com sidebar branca, item ativo em azul claro
  (`#e8f0fe`), topbar branca com breadcrumb, navegação mobile em Sheet, ícones
  `lucide-react` e atalhos `Alt + letra`. O login também é claro e centralizado,
  como no `apps/web-client` do SYSGOV.
- **Cores**: azul GOV.BR `#1351b4` como primário, `#0c326f` em títulos e
  `#071d41` em logo/estados ativos; verde `#168821`, âmbar `#f2a71b`, vermelho
  `#e52207` e azul informativo `#155bcb` nos estados semânticos.
- **Tipografia**: Inter para texto institucional e JetBrains Mono para valores
  monetários, percentuais, datas, códigos, documentos, placas e métricas.
- **Regras**: não usar CSS inline, emojis ou SVGs soltos; reutilizar os
  componentes existentes antes de criar novos; confirmações usam `useConfirm` e
  avisos usam `toast` (nunca `window.confirm`).
- **Carregamento**: as páginas são carregadas sob demanda (`React.lazy` +
  `Suspense`), mantendo o App Shell leve.

## Mapa

Por padrão usa tiles do OpenStreetMap. Para produção, defina
`VITE_MAP_TILE_URL` e `VITE_MAP_ATTRIBUTION` no build do frontend, apontando para
um provedor compatível com a política de uso (ou um servidor próprio de tiles).

## Desenvolvimento

```bash
cd frontend
npm install
npm run dev        # proxy /api → http://localhost:8080
npm test           # Vitest + Testing Library
npm run e2e        # Playwright (requer API e dados semeados)
npm run build      # tsc --noEmit + vite build
npm run format     # Prettier em src, e2e, configs e index.html
```

Os tipos do cliente são gerados a partir do contrato OpenAPI:

```bash
node scripts/gen-api-types.mjs            # atualiza frontend/src/api/generated.ts
node scripts/gen-api-types.mjs --check    # falha se estiverem desatualizados
```
