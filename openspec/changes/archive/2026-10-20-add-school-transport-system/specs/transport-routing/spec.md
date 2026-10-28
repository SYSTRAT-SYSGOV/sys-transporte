# Spec Delta

## Purpose

Define pontos de parada, rotas e itinerários do transporte escolar, com ordenação de paradas, quilometragem e cálculo de ocupação por veículo.

## ADDED Requirements

### Requirement: Pontos de parada georreferenciados
O sistema SHALL permitir cadastrar pontos de embarque e desembarque com nome, endereço de referência e coordenadas opcionais, validando latitude entre -90 e 90 e longitude entre -180 e 180.

#### Scenario: Ponto com coordenadas válidas
- **WHEN** um ponto é cadastrado com latitude e longitude dentro dos limites
- **THEN** ele fica disponível para composição de itinerários e para exibição no mapa

#### Scenario: Coordenada inválida
- **WHEN** a latitude ou longitude está fora dos limites
- **THEN** o sistema responde 422 e não cria o ponto

### Requirement: Cadastro de rotas
O sistema SHALL permitir cadastrar rotas com nome, escola de destino, ano letivo, turno, tipo de rede, empresa, veículo e motorista, aceitando apenas um veículo e um motorista elegíveis.

#### Scenario: Rota rural criada
- **WHEN** um usuário autorizado cadastra uma rota com escola, ano letivo e turno válidos
- **THEN** a rota é criada como ativa e vinculada ao ano letivo informado

#### Scenario: Veículo irregular
- **WHEN** a rota referencia um veículo com vistoria vencida
- **THEN** o sistema responde 409 e indica o veículo irregular

### Requirement: Itinerário ordenado
O sistema SHALL manter, para cada rota, uma sequência de paradas com ordem única, sem repetir o mesmo ponto de parada na mesma rota e com ao menos uma parada para a rota ser considerada válida.

#### Scenario: Reordenação do itinerário
- **WHEN** um usuário reordena as paradas de uma rota
- **THEN** a nova ordem é persistida sem violar a unicidade da sequência

#### Scenario: Ponto repetido
- **WHEN** a mesma parada é incluída duas vezes na mesma rota
- **THEN** o sistema responde 409 e mantém o itinerário anterior

### Requirement: Quilometragem da rota
O sistema SHALL registrar a extensão pavimentada e não pavimentada e apresentar o total como a soma das duas, com precisão de duas casas decimais.

#### Scenario: Total calculado
- **WHEN** a rota informa 12,50 km pavimentados e 7,25 km não pavimentados
- **THEN** o sistema apresenta 19,75 km de extensão total

#### Scenario: Valores negativos
- **WHEN** qualquer extensão informada é negativa
- **THEN** o sistema responde 422 e rejeita o cadastro

### Requirement: Cálculo de ocupação
O sistema SHALL calcular, por rota, a quantidade de alunos com alocação ativa, a capacidade do veículo vinculado e o percentual de ocupação, exibindo o resultado na API e no painel.

#### Scenario: Ocupação parcial
- **WHEN** uma rota tem 20 alunos alocados e veículo com capacidade de 40
- **THEN** a rota apresenta 50% de ocupação

#### Scenario: Rota sem veículo
- **WHEN** a rota não possui veículo vinculado
- **THEN** a ocupação é exibida como não calculável e a rota é sinalizada como pendência

### Requirement: Consulta de rotas
O sistema SHALL permitir listar rotas filtrando por ano letivo, escola, turno, tipo de rede e situação ativa, retornando contagem de paradas e de alunos alocados.

#### Scenario: Filtro por ano e turno
- **WHEN** um usuário filtra rotas pelo ano letivo e turno da manhã
- **THEN** o sistema retorna apenas as rotas correspondentes, com paradas e alunos alocados
