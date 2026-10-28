# Tasks

## 1. Fundação do monorepo e Docker

- [x] 1.1 Criar a estrutura `backend/`, `frontend/`, `db/migrations/`, `docs/` e `README.md` na raiz; verificar que todos os caminhos existem na listagem do diretório
- [x] 1.2 Criar o workspace Rust em `backend/` com Axum, Tokio, SQLx, Serde, Utoipa, jsonwebtoken e argon2; verificar `cargo check` sem erros
- [x] 1.3 Inicializar o app React com Vite + TypeScript e as dependências de router, TanStack Query, Tailwind, Leaflet, Zod e React Hook Form; verificar `npm run build` concluindo
- [x] 1.4 Criar `.env.example`, `.gitignore` e `.dockerignore`; verificar que nenhum segredo real está versionado pela busca por chaves e senhas nos arquivos rastreados
- [x] 1.5 Criar `docker-compose.yml` com os serviços `db`, `api` e `web`, healthchecks e volume nomeado; verificar `docker compose config` válido e `docker compose up -d` com os três serviços saudáveis
- [x] 1.6 Adicionar script `scripts/check` executando `cargo fmt --check`, `cargo clippy`, `cargo test` e `npm run build`; verificar a execução completa do script

## 2. Schema MySQL e migrations

- [x] 2.1 Migration de identidade (`users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `refresh_tokens`, `audit_events`) com grants restritivos na auditoria; verificar aplicação em banco limpo
- [x] 2.2 Migration de núcleo (`schools`, `guardians`, `students`, `student_guardians`, `academic_years`, `enrollments`) com colunas geradas e índices únicos de registro ativo; verificar a aplicação e os índices criados
- [x] 2.3 Migration de frota (`transport_companies`, `transport_drivers`, `transport_vehicles`, `vehicle_inspections`) com `CHECK` de capacidade, categoria de CNH e tipologia Inep; verificar que inserções inválidas são rejeitadas
- [x] 2.4 Migration de rotas (`transport_stops`, `transport_routes`, `transport_route_stops`) com `total_km` gerado e unicidade de `(route_id, sequence_order)`; verificar as constraints no banco
- [x] 2.5 Migration de alocação (`transport_allocations`) com índice único de alocação ativa por aluno e rota; verificar rejeição de duplicidade ativa
- [x] 2.6 Criar seed idempotente de permissões, papéis padrão e administrador inicial a partir de variáveis de ambiente; verificar que executar duas vezes não duplica registros

## 3. Núcleo da API

- [x] 3.1 Implementar configuração por ambiente, pool SQLx e execução de migrations no start; verificar `/health` retornando 200 com status do banco
- [x] 3.2 Implementar erros RFC 7807 e o mapeamento de erros de domínio para HTTP; verificar testes que retornam `application/problem+json` com `errors[]`
- [x] 3.3 Adicionar middleware de `request_id`, tracing em JSON e CORS restrito; verificar que logs de uma requisição compartilham o mesmo identificador
- [x] 3.4 Implementar paginação, filtros e DTOs base reutilizáveis; verificar testes de `page`/`per_page` e do limite máximo de 100
- [x] 3.5 Expor OpenAPI em `/api/v1/openapi.json` e gerar os tipos TypeScript do cliente; verificar que o schema cobre todos os endpoints registrados

## 4. Identidade, acesso e auditoria

- [x] 4.1 Implementar o domínio de usuário e senha com hash Argon2id e política mínima; verificar testes unitários de hash e verificação
- [x] 4.2 Implementar login, refresh com rotação e logout com `token_version`; verificar testes de sucesso, 401 para token expirado e 423 para conta bloqueada
- [x] 4.3 Implementar bloqueio após 5 falhas em 15 minutos e desbloqueio administrativo; verificar testes das duas transições
- [x] 4.4 Implementar middleware de autorização por permissão `<recurso>.<ação>` com negação por padrão; verificar testes de 200 com permissão e 403 sem permissão
- [x] 4.5 Implementar CRUD de usuários, papéis e permissões, incluindo bloqueio de autodesativação; verificar testes HTTP de 409 na autodesativação
- [x] 4.6 Implementar auditoria transacional append-only com `request_id` e diff de campos; verificar que `UPDATE`/`DELETE` na tabela falham com o usuário da API
- [x] 4.7 Documentar os endpoints de identidade em `docs/api/identity.md`; verificar que os exemplos `curl` executam contra a API local

## 5. Cadastro base

- [x] 5.1 Implementar CRUD de escolas com unicidade de código Inep; verificar testes de criação e de 409 em duplicidade
- [x] 5.2 Implementar CRUD de alunos e responsáveis exigindo ao menos um responsável; verificar testes de 422 sem responsável e de vínculo múltiplo
- [x] 5.3 Implementar anos letivos e matrículas com no máximo uma matrícula ativa por aluno, escola e ano; verificar teste de 409 em duplicidade
- [x] 5.4 Implementar encerramento de matrícula com encerramento das alocações ativas; verificar teste de integração que reduz a ocupação da rota
- [x] 5.5 Implementar inativação lógica com exclusão das listagens padrão e preservação em consultas históricas; verificar testes de listagem e de detalhe
- [x] 5.6 Documentar os endpoints de cadastro base em `docs/api/registry.md`; verificar que os exemplos documentados executam

## 6. Frota

- [x] 6.1 Implementar CRUD de empresas prestadoras com vigência de contrato; verificar que contrato vencido bloqueia novas rotas com 409
- [x] 6.2 Implementar cadastro de motoristas com elegibilidade CTB (categoria D/E, idade, curso, toxicológico); verificar testes de 422 para inelegível e 409 no vínculo a rota
- [x] 6.3 Implementar cálculo de alertas de vencimento em 30 dias e documento vencido; verificar teste com CNH a 15 dias e CNH vencida
- [x] 6.4 Implementar CRUD de veículos com placa normalizada e única, capacidade positiva e tipologia Inep de 1 a 11; verificar testes de 409 e 422
- [x] 6.5 Implementar registro de vistorias com histórico e bloqueio de veículo com vistoria vencida; verificar teste que impede alocação de rota
- [x] 6.6 Documentar os endpoints de frota em `docs/api/fleet.md`; verificar que os exemplos documentados executam

## 7. Rotas e itinerários

- [x] 7.1 Implementar CRUD de pontos de parada com validação de latitude e longitude; verificar testes de 422 para coordenadas fora dos limites
- [x] 7.2 Implementar CRUD de rotas com escola, ano letivo, turno, veículo e motorista elegíveis; verificar testes de criação e de 409 com veículo irregular
- [x] 7.3 Implementar itinerário ordenado, reordenação e bloqueio de parada repetida; verificar testes de unicidade da sequência e de 409
- [x] 7.4 Implementar cálculo e exibição da quilometragem total da rota; verificar teste com 12,50 km pavimentados e 7,25 km não pavimentados resultando em 19,75 km
- [x] 7.5 Implementar consulta de ocupação por rota com alunos ativos, capacidade e percentual; verificar teste de 20 alunos em capacidade 40 resultando em 50%
- [x] 7.6 Implementar listagem de rotas com filtros por ano, escola, turno, tipo e situação; verificar teste de filtro combinado
- [x] 7.7 Documentar os endpoints de rotas em `docs/api/routing.md`; verificar que os exemplos documentados executam

## 8. Alocação e Censo

- [x] 8.1 Implementar alocação de estudante validando matrícula ativa e parada pertencente ao itinerário; verificar testes de sucesso e de 422 para parada externa
- [x] 8.2 Implementar controle de capacidade em transação com `SELECT ... FOR UPDATE` na rota; verificar teste concorrente que não ultrapassa a capacidade
- [x] 8.3 Implementar exceção de capacidade com permissão dedicada e justificativa auditada; verificar teste de 409 sem permissão e de sucesso com auditoria
- [x] 8.4 Implementar desvínculo de alocação com data e motivo preservando histórico; verificar teste que libera a vaga na ocupação
- [x] 8.5 Implementar a regra de necessidades especiais exigindo veículo acessível; verificar teste de 409 em veículo não adaptado
- [x] 8.6 Implementar pré-validação do Censo com os quatro tipos de pendência; verificar testes de cenário com pendências e de cenário aprovado
- [x] 8.7 Implementar exportação CSV do Censo com streaming e cabeçalho estável; verificar teste de colunas e de uma linha por aluno alocado ativo
- [x] 8.8 Documentar os endpoints de alocação e censo em `docs/api/allocation.md`; verificar que os exemplos documentados executam

## 9. Console — base

- [x] 9.1 Criar o shell do console com layout, rotas, tema e tela de login integrada ao refresh automático; verificar o fluxo de login e de renovação de sessão
- [x] 9.2 Implementar guarda de rotas e menus por permissão; verificar que usuário sem `identity.user.manage` não vê a administração de usuários
- [x] 9.3 Implementar cliente HTTP tipado a partir do OpenAPI com tratamento de `problem+json`; verificar testes de erro 403 e 422 exibindo mensagens
- [x] 9.4 Criar componentes de tabela, formulário, diálogo e confirmação com estados de carregamento e vazio; verificar testes de renderização e foco do diálogo

## 10. Console — telas de gestão

- [x] 10.1 Implementar telas de escolas, alunos e matrículas com formulários validados; verificar os fluxos de criação e de conflito 409
- [x] 10.2 Implementar telas de empresas, motoristas e veículos exibindo alertas de vencimento; verificar que um motorista com CNH a vencer aparece sinalizado
- [x] 10.3 Implementar tela de vistorias com histórico por veículo; verificar que a vistoria nova passa a ser a vigente
- [x] 10.4 Implementar telas de pontos de parada e rotas com editor de itinerário e ordenação; verificar reordenação refletida após recarregar
- [x] 10.5 Implementar tela de alocação com indicador de capacidade e diálogo de exceção para usuários autorizados; verificar o bloqueio visual ao atingir o limite
- [x] 10.6 Implementar tela de pré-validação do Censo com lista de pendências e botão de exportação CSV; verificar o download do arquivo
- [x] 10.7 Implementar telas de usuários, papéis, permissões e consulta de auditoria; verificar que a trilha filtra por período e recurso

## 11. Console — mapa, painel e apresentação

- [x] 11.1 Implementar o mapa Leaflet com marcadores numerados, escola de destino e lista de paradas sem coordenadas; verificar com uma rota de cinco paradas
- [x] 11.2 Implementar o componente de semáforo de lotação com limiares 80% e 100% e testes unitários das três faixas
- [x] 11.3 Implementar o painel de cartões de alerta com estados crítico, atenção e vazio; verificar com vistoria vencida e sem pendências
- [x] 11.4 Implementar formatação técnica de placa, RENAVAM e CNH em caixa alta com fonte monoespaçada; verificar teste de `abc1d23` exibindo `ABC1D23`
- [x] 11.5 Documentar o uso do console em `docs/console.md`; verificar que o roteiro documentado corresponde às telas implementadas

## 12. Integração e entrega

- [x] 12.1 Criar teste E2E Playwright cobrindo login, cadastro de rota, alocação e exportação do Censo; verificar a execução verde em ambiente Docker
- [x] 12.2 Criar seed de demonstração para desenvolvimento com escolas, veículos, motoristas, rotas e alocações; verificar `docker compose up` com dados visíveis no console
- [x] 12.3 Executar verificação final em ambiente limpo: `docker compose down -v`, `docker compose up --build`, suíte completa de testes e `openspec validate add-school-transport-system --strict`; verificar todos os passos concluídos sem erro
- [x] 12.4 Documentar operação em `docs/operations.md` cobrindo variáveis de ambiente, backup e restauração do volume e atualização de schema; verificar que os comandos documentados executam
