# Spec Delta

## Purpose

Vincula estudantes matriculados a rotas e pontos de parada, aplicando as regras de capacidade do veículo, as necessidades especiais de transporte e a validação do Censo Escolar (Registro 60).

## ADDED Requirements

### Requirement: Alocação de estudante
O sistema SHALL permitir alocar um estudante a uma rota e a uma parada do itinerário daquela rota, exigindo matrícula ativa no mesmo ano letivo da rota e registrando data de início.

#### Scenario: Alocação válida
- **WHEN** um estudante com matrícula ativa é alocado em uma rota do mesmo ano letivo e em uma parada do itinerário
- **THEN** a alocação é criada ativa e passa a contar na ocupação da rota

#### Scenario: Parada fora do itinerário
- **WHEN** a parada informada não pertence ao itinerário da rota
- **THEN** o sistema responde 422 e não cria a alocação

### Requirement: Controle de capacidade do veículo
O sistema SHALL recusar alocações que ultrapassem a capacidade do veículo, permitindo exceção somente por usuário com a permissão `transport.allocation.override_capacity`, que deve registrar justificativa auditada.

#### Scenario: Limite atingido
- **WHEN** a rota já está na capacidade máxima e uma nova alocação é solicitada sem permissão de exceção
- **THEN** o sistema responde 409 e informa a capacidade e a ocupação atual

#### Scenario: Exceção autorizada
- **WHEN** um usuário com permissão de exceção informa justificativa e confirma a alocação acima da capacidade
- **THEN** a alocação é criada, a rota passa a indicar superlotação e a justificativa é registrada na auditoria

### Requirement: Encerramento de alocação
O sistema SHALL permitir desvincular um estudante de uma rota informando data de término e motivo, preservando o registro histórico e liberando a vaga na ocupação.

#### Scenario: Desvínculo
- **WHEN** um usuário desvincula um estudante de uma rota
- **THEN** a alocação é encerrada com data e motivo e a ocupação da rota diminui em uma vaga

### Requirement: Necessidades especiais de transporte
O sistema SHALL permitir indicar que o estudante necessita de transporte adaptado e SHALL impedir sua alocação em rotas cujo veículo não seja acessível.

#### Scenario: Alocação em veículo não adaptado
- **WHEN** um estudante com necessidade de transporte adaptado é alocado em rota com veículo não acessível
- **THEN** o sistema responde 409 e indica a exigência de veículo adaptado

### Requirement: Validação do Censo Escolar (Registro 60)
O sistema SHALL gerar uma pré-validação que lista pendências por estudante, incluindo ausência de alocação ativa, rota sem veículo, estudante rural sem declaração de uso de transporte e estudante com necessidade especial alocado em veículo não adaptado.

#### Scenario: Pendências identificadas
- **WHEN** um usuário executa a pré-validação para o ano letivo
- **THEN** o sistema retorna a lista de estudantes com pendência, o tipo de pendência e o identificador do estudante

#### Scenario: Sem pendências
- **WHEN** todos os estudantes alocados possuem dados consistentes
- **THEN** o sistema retorna a validação como aprovada para o ano letivo

### Requirement: Exportação dos dados do Censo
O sistema SHALL exportar em CSV os dados de transporte por estudante, contendo identificação, escola, turno, uso de transporte rural, poder público responsável e tipologia Inep do veículo utilizado.

#### Scenario: Exportação do ano letivo
- **WHEN** um usuário autorizado exporta os dados do Censo de um ano letivo
- **THEN** o sistema gera um arquivo CSV com uma linha por estudante alocado ativo
