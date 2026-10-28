# core-registry Specification

## Purpose

Mantém o cadastro base autônomo — escolas, alunos, responsáveis, anos letivos e matrículas — que sustenta as alocações de transporte escolar sem depender de sistemas externos.

## Requirements

### Requirement: Cadastro de escolas
O sistema SHALL permitir cadastrar escolas com nome, código Inep opcional, rede de ensino e endereço, exigindo unicidade do código Inep quando informado.

#### Scenario: Escola criada
- **WHEN** um usuário autorizado cadastra uma escola com nome e código Inep inédito
- **THEN** a escola é criada e fica disponível para associação a rotas

#### Scenario: Código Inep duplicado
- **WHEN** o código Inep informado já pertence a outra escola
- **THEN** o sistema responde 409 e não cria o registro

### Requirement: Cadastro de alunos e responsáveis
O sistema SHALL permitir cadastrar alunos com nome, data de nascimento e documento, associando um ou mais responsáveis com grau de parentesco e dados de contato.

#### Scenario: Aluno com dois responsáveis
- **WHEN** o cadastro informa dois responsáveis válidos
- **THEN** ambos ficam vinculados ao aluno e visíveis na consulta

#### Scenario: Aluno sem responsável
- **WHEN** o cadastro não informa nenhum responsável
- **THEN** o sistema responde 422 e exige ao menos um responsável

### Requirement: Anos letivos e matrículas
O sistema SHALL registrar matrículas vinculando aluno, escola, ano letivo, série e turno, permitindo no máximo uma matrícula ativa por aluno, escola e ano letivo.

#### Scenario: Matrícula ativa criada
- **WHEN** um aluno sem matrícula ativa naquela escola e ano é matriculado
- **THEN** a matrícula é criada com status ativa

#### Scenario: Matrícula duplicada
- **WHEN** já existe matrícula ativa para o mesmo aluno, escola e ano letivo
- **THEN** o sistema responde 409 e preserva a matrícula existente

### Requirement: Encerramento de matrícula
O sistema SHALL permitir encerrar uma matrícula informando data e motivo, preservando o histórico e encerrando automaticamente as alocações de transporte ativas vinculadas a ela.

#### Scenario: Matrícula encerrada
- **WHEN** um usuário encerra a matrícula de um aluno alocado ao transporte
- **THEN** a alocação ativa é encerrada na mesma data e o aluno deixa de contar na ocupação da rota

### Requirement: Inativação sem perda de histórico
O sistema SHALL inativar registros por exclusão lógica, mantendo-os referenciáveis por rotas, veículos e alocações históricas e ocultando-os das listagens padrão.

#### Scenario: Escola inativada
- **WHEN** uma escola é inativada
- **THEN** ela deixa de aparecer nas listagens padrão, mas rotas existentes continuam exibindo seu nome
