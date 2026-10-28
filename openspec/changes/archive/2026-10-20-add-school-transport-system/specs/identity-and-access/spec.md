# Spec Delta

## Purpose

Garante que apenas pessoas autorizadas operem o sistema e que toda ação sensível permaneça rastreável, provendo autenticação, papéis, permissões granulares e trilha de auditoria.

## ADDED Requirements

### Requirement: Autenticação por credenciais
O sistema SHALL autenticar usuários ativos por e-mail e senha, emitindo um token de acesso de curta duração e um token de renovação revogável. As senhas SHALL ser armazenadas apenas como hash Argon2id.

#### Scenario: Login bem-sucedido
- **WHEN** um usuário ativo informa e-mail e senha corretos
- **THEN** o sistema retorna um token de acesso e um token de renovação e registra o evento de login

#### Scenario: Credenciais inválidas
- **WHEN** as credenciais não conferem ou o usuário está inativo
- **THEN** o sistema responde 401 com mensagem genérica, sem indicar qual campo falhou

### Requirement: Bloqueio temporário por tentativas falhas
O sistema SHALL bloquear temporariamente a conta após 5 tentativas de login falhas consecutivas em uma janela de 15 minutos, liberando o acesso ao fim do intervalo ou por ação de um administrador.

#### Scenario: Conta bloqueada
- **WHEN** ocorrem 5 falhas consecutivas para o mesmo e-mail
- **THEN** novas tentativas respondem 423 até o término do bloqueio

#### Scenario: Desbloqueio administrativo
- **WHEN** um administrador remove o bloqueio de uma conta
- **THEN** o usuário volta a poder autenticar imediatamente

### Requirement: Papéis e permissões granulares
O sistema SHALL associar cada usuário a um ou mais papéis e cada papel a permissões no formato `<recurso>.<ação>`. Toda operação protegida SHALL ser autorizada pela permissão correspondente, negando por padrão.

#### Scenario: Acesso permitido
- **WHEN** um usuário com a permissão `transport.route.create` cria uma rota
- **THEN** a operação é executada e registrada

#### Scenario: Acesso negado
- **WHEN** um usuário sem a permissão exigida chama o endpoint
- **THEN** o sistema responde 403 e registra a tentativa na auditoria

### Requirement: Requisições autenticadas
O sistema SHALL rejeitar com 401 qualquer requisição a endpoint protegido cujo token esteja ausente, expirado, revogado ou assinado com chave inválida.

#### Scenario: Token expirado
- **WHEN** o token de acesso está expirado
- **THEN** a API responde 401 e o cliente renova a sessão com o token de renovação

#### Scenario: Token revogado
- **WHEN** o usuário é desativado ou faz logout
- **THEN** o token de renovação correspondente deixa de ser aceito

### Requirement: Administração de usuários
O sistema SHALL permitir que usuários com a permissão `identity.user.manage` criem, editem, desativem e redefinam senhas, impedindo que alguém desative a própria conta ou remova o próprio papel de administrador.

#### Scenario: Desativação de usuário
- **WHEN** um administrador desativa um usuário
- **THEN** o acesso é revogado imediatamente e os tokens ativos deixam de ser aceitos

#### Scenario: Autodesativação bloqueada
- **WHEN** um administrador tenta desativar a própria conta
- **THEN** o sistema responde 409 e mantém a conta ativa

### Requirement: Trilha de auditoria
O sistema SHALL registrar em trilha append-only o autor, a data e hora, o recurso, a ação, o identificador do registro e o resultado de toda operação de escrita sensível, sem permitir edição ou exclusão pela aplicação.

#### Scenario: Registro de alteração
- **WHEN** um veículo é atualizado
- **THEN** a auditoria registra o autor, o identificador do veículo, os campos alterados e o horário

#### Scenario: Consulta da trilha
- **WHEN** um usuário com a permissão `identity.audit.read` filtra por período e recurso
- **THEN** o sistema retorna os eventos em ordem cronológica
