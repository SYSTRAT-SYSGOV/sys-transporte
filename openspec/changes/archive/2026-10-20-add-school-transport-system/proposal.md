# Proposal

## Why

O transporte escolar público exige conformidade com o PNATE/FNDE (Lei nº 10.880/2004), com os Arts. 136 a 139 do CTB e com o Censo Escolar (Registro 60), mas a operação ainda depende do legado i-Educar e de controles paralelos em planilhas, sem rastreabilidade de vistoria, habilitação de condutor, lotação real por rota nem trilha de auditoria. Este sistema entrega uma plataforma web autônoma — fora do ecossistema SYSGOV — capaz de operar a frota, os itinerários e a alocação de estudantes com evidência de conformidade para fiscalização e para o repasse federal.

## What Changes

- Criação de um sistema web novo, autônomo (single-tenant, sem dependência do SYSGOV), em monorepo com backend **Rust**, frontend **React** e banco **MySQL 8**, orquestrado por **Docker Compose**.
- **Controle de acesso completo**: usuários, papéis, permissões granulares por recurso/ação, autenticação JWT (access + refresh), hash Argon2id, bloqueio por tentativas e trilha de auditoria append-only de ações sensíveis.
- **Cadastro base próprio**: escolas, alunos, responsáveis, anos letivos e matrículas, substituindo as FKs `core_*`/`educa_*` referenciadas no mapeamento legado.
- **Gestão de frota**: empresas prestadoras e contratos, motoristas com validação de requisitos do CTB (categoria D/E, curso especializado, exame toxicológico), veículos com tipologia Inep e acessibilidade PCD.
- **Vistoria semestral DETRAN** registrada como histórico, com validade calculada e bloqueio operacional de veículo irregular.
- **Malha viária**: pontos de parada georreferenciados, rotas por ano letivo/turno/escola e itinerários com ordem de passagem e quilometragem pavimentada/não pavimentada.
- **Alocação de estudantes** em rota e ponto de parada, com controle de lotação e detecção de superlotação (ilícito de trânsito).
- **Conformidade censitária**: pré-validação do Registro 60 e exportação do conjunto de dados do transporte escolar.
- **Console web**: CRUD de todas as entidades, mapa interativo de itinerário (Leaflet), painel de ocupação com semáforo de capacidade e cartões de alerta de CNH e vistoria.
- **BREAKING**: nenhuma alteração em sistemas existentes; o projeto é greenfield.

## Capabilities

### New Capabilities

- `identity-and-access`: autenticação, gestão de usuários, papéis e permissões, políticas de sessão e auditoria de ações.
- `core-registry`: escolas, alunos, responsáveis, anos letivos e matrículas que dão suporte às alocações de transporte.
- `transport-fleet`: empresas prestadoras, motoristas, veículos e vistorias, incluindo as regras de elegibilidade legal e os alertas de vencimento.
- `transport-routing`: pontos de parada, rotas e itinerários ordenados, com métricas de quilometragem e cálculo de ocupação.
- `student-allocation`: vínculo de estudantes a rotas e paradas, regras de capacidade, necessidades especiais e validação do Censo (Registro 60).
- `operations-dashboard`: comportamento do console web — mapa de itinerário, painel de lotação com semáforo, cartões de alerta e formatação técnica de dados.

### Modified Capabilities

- Nenhuma. O projeto não possui specs existentes (`openspec list --specs` retornou vazio).

## Impact

- **Código**: novo monorepo na raiz — `backend/` (Rust, Axum + SQLx), `frontend/` (React + TypeScript + Vite), `db/migrations/` (MySQL 8), `docker-compose.yml`, `docs/`.
- **APIs**: nova API REST sob `/api/v1/...`, incluindo os 13 endpoints de transporte descritos no mapeamento e os endpoints de identidade, cadastro base e censo.
- **Dependências**: Rust toolchain, Node.js 20+, MySQL 8, Docker com Compose v2; bibliotecas de mapa (Leaflet) e componentes de UI.
- **Dados**: carga inicial de escolas, alunos e matrículas é manual ou por importação CSV; não há migração automática do i-Educar nesta entrega.
- **Sistemas externos**: nenhuma integração com SYSGOV, DETRAN ou INEP; dados de vistoria e Censo são registrados e exportados localmente.
- **Premissas registradas**: implantação single-tenant (o campo `tenant_id` do mapeamento é omitido); autenticação federada gov.br, MFA e recorte multi-tenant ficam fora do escopo desta change.
