# Spec Delta

## Purpose

Administra empresas prestadoras, motoristas, veículos e vistorias do transporte escolar, aplicando as exigências do CTB e do Censo e sinalizando riscos de conformidade.

## ADDED Requirements

### Requirement: Cadastro de empresas prestadoras
O sistema SHALL permitir cadastrar empresas de transporte com CNPJ, número e vigência de contrato, representante legal e situação ativa ou inativa, permitindo associá-las a veículos e rotas.

#### Scenario: Empresa com contrato vencido
- **WHEN** a data de término do contrato é anterior à data atual
- **THEN** a empresa é exibida como contrato vencido e a criação de novas rotas para ela é bloqueada

### Requirement: Elegibilidade do motorista
O sistema SHALL exigir, para cadastrar ou manter um motorista ativo, CNH de categoria D ou E dentro da validade, idade superior a 21 anos, certificado de curso especializado válido e exame toxicológico vigente.

#### Scenario: Motorista inelegível
- **WHEN** o cadastro informa CNH de categoria B ou vencida
- **THEN** o sistema responde 422 e não ativa o motorista

#### Scenario: Vínculo a rota bloqueado
- **WHEN** se tenta associar a uma rota um motorista com exame toxicológico vencido
- **THEN** o sistema responde 409 e não permite o vínculo

### Requirement: Alertas de vencimento de habilitação
O sistema SHALL sinalizar motoristas com CNH, curso especializado ou exame toxicológico vencidos ou a vencer nos próximos 30 dias, informando o tipo e a data de vencimento.

#### Scenario: CNH a vencer
- **WHEN** a validade da CNH está entre hoje e 30 dias à frente
- **THEN** o motorista aparece na lista de alertas com a data de vencimento

#### Scenario: Documento vencido
- **WHEN** a validade já passou
- **THEN** o alerta é classificado como crítico e o motorista fica impedido de ser vinculado a novas rotas

### Requirement: Cadastro de veículos
O sistema SHALL permitir cadastrar veículos com descrição, placa única, capacidade de passageiros maior que zero, tipologia Inep entre 1 e 11, tipo de rede e indicadores de uso exclusivo e acessibilidade.

#### Scenario: Placa duplicada
- **WHEN** a placa informada, normalizada em maiúsculas, já pertence a outro veículo
- **THEN** o sistema responde 409 e não cria o registro

#### Scenario: Capacidade inválida
- **WHEN** a capacidade informada é zero ou negativa
- **THEN** o sistema responde 422 e rejeita o cadastro

### Requirement: Vistoria semestral DETRAN
O sistema SHALL registrar cada vistoria com data, número do certificado e validade, mantendo o histórico e considerando regular apenas o veículo com vistoria válida na data corrente.

#### Scenario: Vistoria registrada
- **WHEN** um usuário registra uma vistoria com validade futura
- **THEN** o veículo passa a ser considerado regular e a vistoria anterior permanece no histórico

#### Scenario: Veículo com vistoria vencida
- **WHEN** a validade da última vistoria é anterior à data atual
- **THEN** o veículo é bloqueado para novas alocações de rota e sinalizado como crítico

### Requirement: Acessibilidade do veículo
O sistema SHALL registrar se o veículo é adaptado para pessoas com deficiência e exibir essa informação nas rotas e alocações em que for utilizado.

#### Scenario: Veículo adaptado
- **WHEN** um veículo é marcado como acessível
- **THEN** ele é identificado como apto a atender alunos com necessidades especiais de transporte
