# operations-dashboard Specification

## Purpose

Define o comportamento do console web do transporte escolar: visualização do itinerário em mapa, painel de lotação com semáforo de capacidade, cartões de alerta de conformidade e formatação técnica dos dados.

## Requirements

### Requirement: Acesso autenticado ao console
O console web SHALL exigir sessão autenticada para qualquer tela e SHALL exibir apenas os menus e ações permitidos pelas permissões do usuário.

#### Scenario: Acesso sem sessão
- **WHEN** um visitante acessa uma rota interna do console
- **THEN** é redirecionado para a tela de login sem exibir dados do sistema

#### Scenario: Menu por permissão
- **WHEN** um usuário sem permissão de gestão de usuários autentica-se
- **THEN** a opção de administração de usuários não é exibida

### Requirement: Mapa interativo do itinerário
O console SHALL exibir as paradas de uma rota em mapa, com marcadores numerados conforme a ordem do itinerário e a escola de destino destacada, sinalizando paradas sem coordenadas.

#### Scenario: Rota com paradas georreferenciadas
- **WHEN** um usuário abre o mapa de uma rota com paradas coordenadas
- **THEN** o console exibe os marcadores na ordem do itinerário e o marcador da escola de destino

#### Scenario: Parada sem coordenadas
- **WHEN** uma parada não possui latitude ou longitude
- **THEN** o console a lista fora do mapa com indicação de coordenada ausente

### Requirement: Painel de lotação com semáforo
O console SHALL exibir a ocupação de cada rota com indicador visual classificado em verde até 80%, amarelo entre 81% e 100% e vermelho acima de 100%, acompanhado de capacidade e número de alunos.

#### Scenario: Ocupação acima da capacidade
- **WHEN** a rota tem mais alunos alocados do que a capacidade do veículo
- **THEN** o indicador é exibido em vermelho com alerta de superlotação

#### Scenario: Ocupação dentro do limite
- **WHEN** a ocupação é de até 80%
- **THEN** o indicador é exibido em verde

### Requirement: Cartões de alerta de fiscalização
O console SHALL destacar em painel os alertas de CNH, curso especializado e exame toxicológico a vencer em até 30 dias ou vencidos, e de vistoria DETRAN vencida ou a vencer no semestre corrente.

#### Scenario: Alerta crítico
- **WHEN** existe veículo com vistoria vencida
- **THEN** o painel exibe o cartão de alerta crítico com o veículo e a data de vencimento

#### Scenario: Sem alertas
- **WHEN** não há documentos vencidos ou a vencer
- **THEN** o painel exibe estado vazio informando ausência de pendências

### Requirement: Formatação técnica de identificadores
O console SHALL exibir placas, RENAVAM e CNH em caixa alta, sem caracteres separadores inconsistentes, utilizando fonte monoespaçada.

#### Scenario: Exibição de placa
- **WHEN** um veículo com placa `abc1d23` é exibido
- **THEN** o console mostra `ABC1D23` em fonte monoespaçada
