# Aderência às especificações do legado

Este documento confronta os artefatos de engenharia reversa do módulo de
transporte escolar do i-Educar, em `Transport/`, com o que foi implementado neste
repositório. O objetivo é registrar o que foi absorvido, o que foi adaptado e o
que permanece em aberto.

## Origem

- `Transport/requirements.md` — requisitos funcionais e não funcionais (RF/RNF).
- `Transport/design.md` — entidades, telas e regras observadas no legado.
- `Transport/contracts.md` — contratos de tela, API e Censo (Registro 60).
- `Transport/flows.md` — fluxos de cadastro, alocação e exportação.
- `Transport/legacy-mapping.md` — mapeamento para o modelo alvo.
- `Transport/tasks.md` — sequência de reimplementação.
- `Transport/questions.md` — lacunas que dependiam de validação humana.

## Decisões de adaptação

| Tema | Legado / modelo alvo | Neste projeto |
| --- | --- | --- |
| Isolamento | multi-tenant SYSGOV com `tenant_id` | single-tenant, por decisão de escopo; todas as consultas são restritas ao banco da instalação |
| Identidade de pessoa | módulo `pessoa` compartilhado | aluno, responsável e motorista têm nome/CPF próprios |
| Persistência | PostgreSQL/Laravel no alvo | MySQL 8 + Rust (Axum/SQLx), conforme requisito do projeto |
| Endereço | serviço de CEP preenche endereço e coordenadas | endereço e coordenadas informados manualmente; integração de CEP segue em aberto (Q-08) |
| Rotas | uma escola de destino por rota | mantido: `school_id` único na rota |
| Pessoa de transporte | vínculo aluno–rota–parada | `transport_allocations`, com histórico de encerramento |

## Requisitos absorvidos

### Empresa, motorista e veículo

- Empresa com CNPJ, contrato e vigência; contrato vencido bloqueia rota e
  alocação (`409`).
- Motorista com CNH, categoria D/E, data da primeira habilitação, vencimento,
  curso especializado e exame toxicológico. A elegibilidade é recalculada a cada
  vínculo e a cada alocação.
- Veículo com placa normalizada, RENAVAM, chassi, marca/modelo, anos, capacidade,
  tipo de rede, tipologia Inep (1 a 11), exclusividade, acessibilidade, data da
  licença, condutor padrão, situação e motivo de inativação.
- Vistoria semestral com histórico; vistoria vencida impede rota e alocação.

### Paradas e rotas

- Parada com CEP, logradouro, número, complemento, bairro, cidade, UF, ponto de
  referência e coordenadas validadas.
- Consulta de paradas por rota em `GET /transport/stops?route_id=<id>`, na ordem
  do itinerário.
- Rota com escola, ano letivo, empresa, veículo, motorista, turno, tipo, km
  pavimentado/não pavimentado e `total_km` calculado.
- Itinerário ordenado, sem parada repetida.

### Alocação

- Matrícula ativa no ano letivo da rota.
- Parada obrigatoriamente pertencente ao itinerário.
- Turno da alocação deve coincidir com o turno da rota (`422`).
- Capacidade controlada em transação (`SELECT … FOR UPDATE`); superlotação
  bloqueada por padrão e permitida apenas com `transport.allocation.override_capacity`
  e justificativa auditada.
- Necessidade especial exige veículo adaptado.
- Contrato, vistoria e documentação do condutor são revalidados na alocação.
- Desvínculo preserva data e motivo, liberando a vaga.

### Censo escolar (Registro 60)

- Pré-validação com pendências: sem alocação ativa, rota sem veículo, rural sem
  poder público declarado e veículo não adaptado.
- Exportação CSV com uma linha por aluno alocado ativo, incluindo:
  - `transporte_publico`;
  - `poder_publico_responsavel_transporte` (1 estadual, 2 municipal, 3 compartilhado);
  - marcações por tipologia Inep (van/konbi, micro-ônibus, ônibus, bicicleta,
    tração animal, outro, aquaviário por faixa e ferroviário).
- A declaração é anulada quando a matrícula não tem atendimento curricular, quando
  a mediação é `distancia` ou quando o país de residência não é `BR`.

### Auditoria

- Eventos transacionais append-only com `request_id`, ator, recurso, ação,
  antes/depois, incluindo justificativas de exceção de capacidade.

## Pendências e limitações

1. **Q-01/Q-02** — as classes servidoras do legado não estavam disponíveis; as
   regras de unicidade e cascade foram reconstruídas a partir dos contratos e do
   bom senso de domínio.
2. **Q-08** — não há integração com serviço de CEP; o cadastro de parada é manual.
3. **Multi-tenant** — não implementado por decisão de escopo (projeto autônomo).
4. **Múltiplas escolas por rota (Q-13)** — a rota continua com uma escola de
   destino; o modelo permite evoluir para N:N sem quebrar o contrato atual.
5. **Validação do Registro 60** — a pré-validação não sinaliza turmas anuladas
   pela regra de atendimento/mediação/país; a anulação é aplicada na exportação.
