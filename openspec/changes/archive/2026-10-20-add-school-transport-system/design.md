# Design

## Context

Projeto greenfield: o repositório contém apenas o `legacy-mapping.md` (engenharia reversa do módulo de transporte do i-Educar) e a estrutura do OpenSpec. Não há código, banco nem infraestrutura a preservar — ver `proposal.md` para a motivação.

Restrições que moldam o desenho:

- O mapeamento original assume PostgreSQL 16 com `uuid`, colunas geradas e FKs para o núcleo do SYSGOV. A entrega é **MySQL 8** e **autônoma**, então UUIDs, colunas derivadas e entidades de núcleo precisam de tradução explícita.
- Requisitos legais (CTB arts. 136–139, PNATE, Censo Registro 60) são regras de negócio verificáveis, não apenas campos — devem ser validadas no servidor, nunca só na interface.
- Toda operação sensível precisa de rastreabilidade (auditoria append-only), o que influencia o desenho de transações e permissões de banco.
- Implantação única por órgão (single-tenant), executável com um único `docker compose up`.

## Goals / Non-Goals

**Goals:**

- Monorepo com backend Rust, frontend React e MySQL 8 subindo por Docker Compose com um comando.
- Regras de conformidade (elegibilidade de condutor, vistoria, capacidade, Censo) aplicadas na camada de domínio, com testes automatizados.
- Autorização por permissão granular verificada em cada endpoint e refletida na navegação do console.
- Modelo de dados que preserve o histórico (vistorias, alocações, auditoria) sem exclusões físicas.
- Consultas de ocupação e de alertas eficientes o suficiente para listagens de algumas centenas de rotas.

**Non-Goals:**

- Multi-tenancy, federação gov.br, MFA e recuperação de senha por e-mail (fora do escopo desta change).
- Integração automática com DETRAN, INEP ou SYSGOV; os dados são registrados e exportados localmente.
- Roteirização viária real (cálculo de traçado por malha de ruas): o mapa liga as paradas na ordem do itinerário.
- Migração automatizada de dados do i-Educar; a carga inicial é manual ou por CSV.
- Aplicativo móvel e rastreamento GPS em tempo real.

## Decisions

### 1. Backend Rust com Axum + SQLx (em vez de Actix + Diesel)

Axum é mantido pela organização Tokio, tem extração tipada de requests, middleware via `tower` e integração direta com `sqlx::MySqlPool`. SQLx oferece queries verificadas em tempo de compilação (`query!` com banco de teste) e migrations versionadas embutidas no binário, eliminando um passo de deploy separado. Actix + Diesel foi considerado, mas exige mais cerimônia de macros e um runner de migrations externo.

Organização em módulos verticais por capacidade (`identity`, `registry`, `fleet`, `routing`, `allocation`, `dashboard`), cada um com `domain`, `application` (casos de uso), `infra` (repositórios) e `api` (handlers/DTOs). Regras de negócio ficam em tipos de domínio que retornam erros tipados, traduzidos para HTTP na borda.

### 2. MySQL 8 com UUID em `CHAR(36)` e chaves naturais nas regras

O mapeamento usa `UUID`; no MySQL a tradução viável é `BINARY(16)` (compacto, ilegível em logs) ou `CHAR(36)` (legível, 36 bytes por coluna e por índice). Para o volume esperado (dezenas de milhares de alunos, centenas de rotas), `CHAR(36)` com `utf8mb4_bin` é a escolha: depuração e suporte operacional pesam mais que os bytes. IDs são gerados na aplicação (UUID v7), preservando ordenação temporal nos índices.

Consequências: enums viram `VARCHAR` com `CHECK` (MySQL 8.0.16+ valida `CHECK`), `total_km` vira coluna gerada `STORED`, e datas usam `DATETIME(6)` em UTC (evitando o limite de 2038 do `TIMESTAMP`).

### 3. Regras que dependem de "apenas um ativo" usam coluna gerada + índice único

MySQL não tem índice único parcial. Para garantir "uma matrícula ativa por aluno/escola/ano" e "uma alocação ativa por aluno/rota", cada tabela terá uma coluna gerada `active_flag` (ex.: `CASE WHEN deleted_at IS NULL AND end_date IS NULL THEN 1 ELSE NULL END`) incluída em índice único composto. O banco passa a ser a última linha de defesa contra corrida entre requisições; a aplicação valida antes para devolver mensagens claras.

### 4. Capacidade da rota protegida por transação com bloqueio de linha

Alocação e desalocação executam em transação que faz `SELECT ... FOR UPDATE` na linha da rota, conta alocações ativas e decide. Isso serializa apenas escritas concorrentes da mesma rota, evitando superlotação por dupla requisição. A exceção de capacidade exige a permissão `transport.allocation.override_capacity` e grava a justificativa no mesmo commit.

O percentual de ocupação é calculado em SQL (`alunos_ativos / capacidade`), arredondado a duas casas, e exposto na listagem de rotas — sem materialização, já que a contagem é barata com índice por `route_id` e `end_date`.

### 5. Autenticação JWT com rotação de refresh token e Argon2id

Token de acesso de 15 minutos (HS256 com segredo de 256 bits vindo do ambiente) carrega `sub`, `roles` e `token_version`. Token de renovação de 7 dias é opaco, armazenado apenas como hash SHA-256 na tabela `refresh_tokens`, com rotação a cada uso e revogação em logout/desativação. Desativar usuário ou trocar senha incrementa `token_version`, invalidando imediatamente todos os acessos.

Permissões não vão no JWT (ficariam defasadas); são resolvidas por requisição a partir do cache em memória com TTL de 60 s por usuário, invalidado em qualquer alteração de papel. Alternativa descartada: sessões em Redis — adicionaria um serviço obrigatório ao Compose sem ganho relevante neste porte.

### 6. Auditoria append-only reforçada por grants de banco

`audit_events` guarda `actor_id`, `action`, `resource`, `resource_id`, `before`/`after` (JSON), `ip`, `request_id` e `created_at`. A gravação ocorre na mesma transação da operação de negócio, garantindo que não exista alteração sem rastro. Além de a aplicação não expor update/delete, o usuário MySQL da API recebe apenas `INSERT`/`SELECT` nessa tabela (grants aplicados na migration), e o `request_id` correlaciona logs e auditoria.

### 7. API REST em `/api/v1` com erros RFC 7807

Recursos seguem o mapeamento (`/api/v1/transport/vehicles`, `/routes/{id}/students`, etc.), com paginação por `page`/`per_page` (máx. 100), filtros por query string e respostas de erro em `application/problem+json` com `type`, `title`, `status`, `detail` e `errors[]` por campo. OpenAPI é gerado por `utoipa` a partir dos DTOs, servido em `/api/v1/openapi.json`, e o frontend deriva tipos TypeScript do schema.

Alternativa descartada: GraphQL — o domínio é fortemente relacional e o console é CRUD-oriented; REST reduz custo de autorização por endpoint.

### 8. Frontend React 19 + Vite + TanStack Query + Tailwind + Leaflet

Vite para build rápido; TanStack Query para cache e invalidação após mutações; React Router com rotas protegidas por permissão; React Hook Form + Zod para formulários espelhando as validações do servidor (que continua sendo a autoridade); Leaflet com tiles OpenStreetMap para o itinerário. Componentes acessíveis via Radix primitives.

O controle de acesso na UI é apenas usabilidade: cada rota e ação consulta o conjunto de permissões da sessão, mas o backend rejeita qualquer chamada não autorizada independentemente da tela.

Semáforo de lotação implementado como componente único (`OccupancyBadge`) com limiares 80/100, reutilizado em lista, detalhe e painel, garantindo consistência com a regra da spec.

### 9. Docker Compose com três serviços e migrations no start da API

- `db`: `mysql:8.4`, volume nomeado, `utf8mb4`, healthcheck `mysqladmin ping`, credenciais via `.env` (nunca no repositório).
- `api`: build multi-stage Rust (`cargo chef` para cache de dependências), binário distroless, roda `sqlx migrate run` no entrypoint antes de subir o servidor, healthcheck em `/health`.
- `web`: build Node e serve estáticos via nginx, com proxy `/api` para `api` e fallback SPA.
- Rede interna única; apenas `web` publica porta. Perfil `dev` adiciona hot reload (Vite dev server + `cargo watch`).

Segredos vêm de `.env` (JWT secret, senha do banco); a imagem não contém segredos nem dados de seed. Um `seed` opcional cria papéis, permissões e o usuário administrador inicial a partir de variáveis de ambiente.

### 10. Testes por camada

Regras de domínio (elegibilidade, capacidade, sequência de itinerário, pendências do Censo) em testes unitários puros, sem banco. Repositórios e transações em testes de integração contra MySQL efêmero via `testcontainers`. Endpoints cobertos com testes HTTP (autorização 401/403, validações 422, conflitos 409). Frontend com Vitest para componentes de regra (semáforo, formatação) e um fluxo Playwright de login → cadastro de rota → alocação.

## Risks / Trade-offs

- **`CHAR(36)` para UUID aumenta índices e FKs** → aceitável no porte previsto; se o volume crescer, migrar para `BINARY(16)` com função de conversão é uma mudança localizada.
- **MySQL sem índice único parcial** → mitigado por colunas geradas em índices únicos; exige cuidado ao alterar a regra de "ativo".
- **Sem PostGIS, consultas geográficas são limitadas** → coordenadas numéricas atendem ao mapa e ao Censo; busca por proximidade fica fora do escopo.
- **Nginx e API em contêineres separados podem divergir de CORS** → em produção o proxy torna a origem única; CORS fica restrito ao perfil de desenvolvimento.
- **Cache de permissões de 60 s pode conceder acesso recém-revogado** → incremento de `token_version` e invalidação explícita em mudanças de papel cobrem os casos críticos; o TTL é uma rede de segurança.
- **Bloqueio por linha da rota reduz concorrência de escrita** → escritas por rota são naturalmente seriais; leituras não são afetadas.
- **Traçado do mapa é uma polilinha entre paradas** → pode sugerir caminho inexistente; a UI rotula como "itinerário estimado" e não como navegação.
- **Exportação CSV do Censo em memória** → para anos letivos grandes, trocar por streaming; o volume esperado permite começar simples.

## Migration Plan

Sistema novo, sem dados legados — a "migração" é a implantação inicial.

1. Preencher `.env` a partir de `.env.example` (segredos, credenciais do banco, administrador inicial).
2. `docker compose up -d --build`; a API aplica as migrations e executa o seed idempotente de papéis/permissões.
3. Verificar `/health` e autenticar com o administrador criado no seed; trocar a senha no primeiro acesso.
4. Cadastrar escolas, ano letivo, alunos e matrículas (manual ou importação CSV).
5. Cadastrar empresas, motoristas, veículos e vistorias; depois rotas, paradas e alocações.
6. Executar a pré-validação do Censo antes de exportar o arquivo do ano letivo.

Rollback: `docker compose down` e restauração do volume `db_data` a partir do backup (`mysqldump`) tirado antes de qualquer atualização de schema. Migrations são aditivas por convenção; alterações destrutivas exigem migration de reversão explícita.

## Open Questions

- Definir a origem dos tiles do mapa em produção (servidor próprio ou provedor com chave) — não altera specs nem o plano de tarefas.
- Confirmar se o órgão exige retenção de auditoria além de 5 anos; a tabela já suporta particionamento por data se necessário.
