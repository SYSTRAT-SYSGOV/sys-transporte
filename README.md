# Sistema de Transporte Escolar

Sistema web autônomo de gestão de transporte escolar público, com backend em **Rust**
(Axum + SQLx), frontend em **React** (Vite + TypeScript + shadcn/ui), banco
**MySQL 8** e orquestração por **Docker Compose**.

Atende aos requisitos do PNATE/FNDE (Lei nº 10.880/2004), do Código de Trânsito
Brasileiro (Arts. 136 a 139) e do Censo Escolar (Registro 60).

## Recursos

- **Identidade e acesso**: JWT (15 min) + refresh com rotação (7 dias), Argon2id,
  bloqueio após 5 falhas por 15 min, papéis e permissões granulares (`<recurso>.<ação>`),
  auditoria transacional append-only com `request_id`.
- **Cadastros**: escolas (INEP único), alunos com responsáveis, anos letivos e
  matrículas (uma ativa por aluno/escola/ano, com atendimento curricular, mediação
  didática e país de residência para o Registro 60).
- **Frota**: empresas com vigência contratual, motoristas com elegibilidade CTB
  (incluindo data da primeira habilitação), veículos com placa normalizada,
  tipologia Inep, condutor padrão e vistorias semestrais.
- **Rotas**: pontos de parada georreferenciados, itinerário ordenado, quilometragem
  total gerada, filtros, consulta de paradas por rota e cálculo de ocupação.
- **Alocação e Censo**: controle transacional de capacidade (`SELECT … FOR UPDATE`),
  turno igual ao da rota, revalidação de contrato/vistoria/CNH a cada alocação,
  exceção auditada, regra de acessibilidade, pré-validação com quatro tipos de
  pendência e CSV com as variáveis do Registro 60.
- **Console**: painel com semáforo de lotação e alertas de vencimento, CRUDs
  completos, mapa Leaflet do itinerário e administração de usuários/papéis/auditoria.

## Estrutura

```
backend/        API REST em Rust
frontend/       Console web em React
db/migrations/  Migrations MySQL (aplicadas pela API no start)
docs/           Documentação de API, console e operação
scripts/        Verificação e geração de tipos
openspec/       Artefatos de planejamento (proposta, specs, design, tarefas)
Transport/      Especificações extraídas do legado i-Educar (Reversa)
```

## Execução

1. Copie `.env.example` para `.env` e defina os segredos
   (`MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`, `JWT_SECRET`, `ADMIN_PASSWORD`).
2. `docker compose up -d --build`
3. Acesse `http://localhost:8080` e autentique com `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

A API fica atrás do proxy do nginx em `/api/v1`, com OpenAPI em
`/api/v1/openapi.json` e health em `/health`.

Para popular dados de demonstração, use `SEED_DEMO=true` no primeiro start.

## Desenvolvimento

```bash
# backend
cd backend
cargo run                 # migrations + seed automáticos
cargo test
cargo clippy --all-targets -- -D warnings

# frontend
cd frontend
npm install
npm run dev               # proxy /api → http://localhost:8080
npm test                  # Vitest + Testing Library
npm run e2e               # Playwright
npm run build             # tsc --noEmit + vite build
npm run format            # Prettier
```

A interface segue o **Design System SYSGOV** no padrão do web-client: shadcn/ui
sobre Radix, paleta GOV.BR azul (`#1351b4`, `#0c326f`, `#071d41`), sidebar e
login claros, títulos em `#0c326f`, componentes compartilhados via `@sysgov/ui`,
ícones `lucide-react`, Inter para texto e JetBrains Mono para números, datas,
códigos e métricas. Contratos em
[`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md), catálogo em
[`docs/design-system.md`](docs/design-system.md) e telas em
[`docs/console.md`](docs/console.md#design-system).

Tipos do cliente são gerados do contrato OpenAPI:

```bash
node scripts/gen-api-types.mjs            # atualiza frontend/src/api/generated.ts
node scripts/gen-api-types.mjs --check    # falha se houver divergência
```

## Verificação

`scripts/check.ps1` (Windows) ou `scripts/check.sh` (Linux/macOS) executam
`cargo fmt --check`, `cargo clippy -D warnings`, `cargo test`, `npm run build`,
`npm test` e a checagem dos tipos gerados.

## Documentação

- [`docs/api/identity.md`](docs/api/identity.md)
- [`docs/api/registry.md`](docs/api/registry.md)
- [`docs/api/fleet.md`](docs/api/fleet.md)
- [`docs/api/routing.md`](docs/api/routing.md)
- [`docs/api/allocation.md`](docs/api/allocation.md)
- [`docs/legacy-alignment.md`](docs/legacy-alignment.md)
- [`docs/console.md`](docs/console.md)
- [`docs/design-system.md`](docs/design-system.md)
- [`docs/operations.md`](docs/operations.md)

## Segurança

- Nenhum segredo real é versionado; `.env` está no `.gitignore`.
- Senhas: Argon2id; política mínima de 8 caracteres com letra e número.
- Refresh tokens são armazenados como hash e rotacionados a cada uso.
- A tabela de auditoria rejeita `UPDATE`/`DELETE` por trigger.
- CORS restrito por `CORS_ORIGINS`.
