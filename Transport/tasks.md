# Transporte Escolar (i-Educar legado), Tarefas de Implementação

> Sequência de tarefas executáveis para reimplementar a unit de transporte escolar a partir do legado, com rastreabilidade ao código original.
> Confiança: 🟢 CONFIRMADO no código, 🟡 INFERIDO, 🔴 LACUNA.

---

## Pré-requisitos

- [ ] Dependências da unit listadas em `design.md` estão disponíveis: cadastro de pessoas, cadastro de aluno, módulo de escola, módulo de Censo Escolar, serviço de CEP.
- [ ] Schema e migrations do banco compatíveis com as tabelas `educa_transport_*` descritas em `_reversa_sdd/Transport/legacy-mapping.md`, com `tenant_id` em todas as entidades.
- [ ] Variáveis de ambiente e credenciais do serviço de CEP e georreferenciamento documentadas.
- [ ] Regra de isolamento por tenant definida e aplicada a todas as consultas da unit.
- [ ] Contrato do pacote `@sysgov/sdk` definido para as seis entidades e para a alocação de estudante.

---

## Tarefas

> Cada tarefa referencia o arquivo do legado de onde o comportamento foi extraído.

- [ ] T-01, Modelar a entidade de empresa de transporte com pessoa jurídica, responsável legal, contrato, vigência, situação e motivo de inativação
  - Origem no legado: `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Empresa.js:46-50`
  - Critério de pronto: tabela `educa_transport_companies` criada, com `tenant_id`, chaves estrangeiras para pessoa jurídica e responsável, e teste de criação e inativação com motivo
  - Confiança: 🟡

- [ ] T-02, Modelar a entidade de condutor com pessoa, empresa, CNH, categoria, emissão, vencimento, curso do CONTRAN e exame toxicológico
  - Origem no legado: `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Motorista.js:46-54`
  - Critério de pronto: tabela `educa_transport_drivers` criada, com validação de categoria em `D` e `E` e teste de recusa de categoria inválida
  - Confiança: 🟡

- [ ] T-03, Modelar a entidade de veículo com identificação, lotação, malha, tipologia INEP, exclusividade, acessibilidade, vistoria do DETRAN e situação
  - Origem no legado: `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Veiculo.js:46-82`
  - Critério de pronto: tabela `educa_transport_vehicles` criada, com normalização de placa, capacidade maior que zero e conversão dos indicadores de par de caracteres para booleano
  - Confiança: 🟡

- [ ] T-04, Modelar a entidade de ponto de parada com endereço de referência, município, coordenadas numéricas e situação
  - Origem no legado: `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Ponto.js:32-46`
  - Critério de pronto: tabela `educa_transport_stops` criada, com validação de faixa de latitude e longitude e teste de recusa de coordenada fora do intervalo
  - Confiança: 🟡

- [ ] T-05, Modelar a entidade de rota com escola de destino, empresa, ano letivo, turno, extensões e total calculado
  - Origem no legado: `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Rota.js:43-57`
  - Critério de pronto: tabela `educa_transport_routes` criada, com extensão total gerada pela soma das duas extensões e teste de recusa de extensão negativa
  - Confiança: 🟡

- [ ] T-06, Modelar a associação ordenada entre rota e ponto de parada, com horários estimados de embarque e desembarque
  - Origem no legado: ausência de ordem no legado, evidenciada por `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Rota.js:43-57`
  - Critério de pronto: tabela `educa_transport_route_stops` criada, com índice único por rota e posição e teste de recusa de posição duplicada
  - Confiança: 🟡

- [ ] T-07, Modelar a alocação de estudante à rota e ao ponto de embarque, com matrícula, escola, turno, transporte rural, poder público responsável e necessidade especial
  - Origem no legado: `ieducar/modules/Api/Views/AlunoController.php:1789-1797`
  - Critério de pronto: tabela `educa_transport_students` criada, com desvinculação lógica por data de término e teste de recusa de turno divergente do turno da rota
  - Confiança: 🟡

- [ ] T-08, Implementar a normalização do tipo de transporte do aluno, preservando o domínio legado e adicionando o valor compartilhado do Registro 60
  - Origem no legado: `app/Models/TransportationProvider.php:9-36`
  - Critério de pronto: `municipal` para 2, `estadual` para 1, compartilhado para 3 e demais para 0, com teste unitário para cada valor
  - Confiança: 🟢

- [ ] T-09, Implementar a validação de domínio do tipo de transporte na API de aluno
  - Origem no legado: `ieducar/modules/Api/Views/AlunoController.php:102-109`
  - Critério de pronto: requisição com valor fora do conjunto é rejeitada com erro no campo, com teste automatizado
  - Confiança: 🟢

- [ ] T-10, Implementar a serialização da lista de tipos de veículo de transporte escolar, preservando o formato de array e a leitura por conversão do array do banco
  - Origem no legado: `ieducar/modules/Api/Views/AlunoController.php:651-657` e `:1223`
  - Critério de pronto: escrita aceita array e persiste como lista, leitura devolve array, com teste de ida e volta
  - Confiança: 🟢

- [ ] T-11, Implementar a regra de anulação da declaração de transporte público no Registro 60
  - Origem no legado: `src/Modules/Educacenso/ExportRule/TransporteEscolarPublico.php:23-27`
  - Critério de pronto: regra reaplicada com os três gatilhos de anulação, com teste para cada gatilho e teste de não anulação no caso feliz
  - Confiança: 🟢

- [ ] T-12, Implementar a visão ou projeção de exportação do Registro 60 com as flags de tipologia modal por código INEP
  - Origem no legado: `database/sqls/views/public.educacenso_record60.sql:25-49`
  - Critério de pronto: projeção produz `transportePublico`, `poderPublicoResponsavelTransporte` e as flags de tipologia, incluindo o código ferroviário ausente no legado
  - Confiança: 🟢

- [ ] T-13, Implementar a consulta de pontos por rota usada pela tela de pessoa de transporte
  - Origem no legado: `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Pessoatransporte.js:1-24`
  - Critério de pronto: endpoint devolve apenas os pontos vinculados à rota informada, com teste de isolamento entre rotas
  - Confiança: 🟢

- [ ] T-14, Implementar a verificação de lotação e a classificação da ocupação por faixa, com superlotação vedada
  - Origem no legado: ausência de verificação no legado, evidenciada pela ausência de referência em `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Veiculo.js:46-82`
  - Critério de pronto: alocação que excede a capacidade é recusada, e o relatório classifica a faixa regular, de limite e de superlotação
  - Confiança: 🟡

- [ ] T-15, Implementar a validação de vigência contratual da empresa no vínculo de rota e na alocação
  - Origem no legado: campo inexistente no legado, evidenciado por `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Empresa.js:46-50`
  - Critério de pronto: criação de rota e alocação são recusadas quando o contrato está fora da vigência, com teste de recusa e de liberação
  - Confiança: 🟡

- [ ] T-16, Implementar a validação de conformidade do condutor e do veículo no momento da escala de rota
  - Origem no legado: campos inexistentes no legado, evidenciados por `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Motorista.js:46-54` e `Veiculo.js:46-82`
  - Critério de pronto: escala é recusada com credencial vencida ou vistoria vencida, com teste para cada credencial
  - Confiança: 🟡

- [ ] T-17, Implementar a API REST do módulo de transporte com as rotas de listagem, criação, edição e desativação por entidade
  - Origem no legado: `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Empresa.js:25` e `Rota.js:22` (destinos de redirecionamento no intranet)
  - Critério de pronto: contrato OpenAPI gerado, com paginação e filtro por tenant em todas as listagens
  - Confiança: 🟡

- [ ] T-18, Implementar o contrato TypeScript da unit no pacote `@sysgov/sdk`
  - Origem no legado: `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Rota.js:43-57`
  - Critério de pronto: tipos `TransportCompany`, `TransportDriver`, `TransportVehicle`, `TransportStop`, `TransportRoute` e `TransportStudentAllocation` publicados e consumidos por um cliente de teste
  - Confiança: 🟡

- [ ] T-19, Implementar a trilha de auditoria com ator, data e valores anteriores e posteriores em todas as escritas da unit
  - Origem no legado: `ieducar/modules/Api/Views/AlunoController.php:1809` (registro de `ref_usuario_exc`)
  - Critério de pronto: toda escrita gera registro de auditoria consultável por tenant e por entidade
  - Confiança: 🟢

- [ ] T-20, Implementar a tela de mapa do itinerário com marcadores ordenados e o painel de ocupação por faixa
  - Origem no legado: `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Ponto.js:37-38` (coordenadas do ponto) e `Veiculo.js:54` (lotação)
  - Critério de pronto: marcadores numerados na ordem do itinerário e barra de ocupação com rótulo textual em cada faixa
  - Confiança: 🟡

---

## Tarefas de Teste

- [ ] TT-01, Teste do happy path do fluxo principal de vínculo de estudante (ver `requirements.md`, Critérios de Aceitação)
- [ ] TT-02, Teste do caso de erro principal: valor de tipo de transporte fora do domínio é rejeitado
- [ ] TT-03, Teste da regra de anulação da exportação do Registro 60 para os três gatilhos
- [ ] TT-04, Teste da ida e volta da lista de tipos de veículo de transporte escolar
- [ ] TT-05, Teste de isolamento por tenant em todas as listagens e em todos os vínculos
- [ ] TT-06, Teste da recusa de alocação acima da capacidade, com verificação do excesso de vagas
- [ ] TT-07, Teste da recusa de escala com credencial de condutor vencida e com vistoria de veículo vencida
- [ ] TT-08, Teste da rejeição de posição duplicada na ordem de paradas da rota
- [ ] TT-09, Teste da consulta de pontos por rota, garantindo que rotas diferentes não compartilhem pontos
- [ ] TT-10, Teste da conversão do arranjo legado de tipos de veículo, marcando o valor não mapeado

---

## Tarefas de Migração de Dados (se aplicável)

- [ ] TM-01, Migrar as empresas de `modules.empresa_transporte_escolar` para `educa_transport_companies`, com mapa de de/para de `ref_idpes` e `ref_resp_idpes`
- [ ] TM-02, Migrar os motoristas de `modules.motorista` para `educa_transport_drivers`, preservando `cnh` e `tipo_cnh` e criando os campos de credencial vazios
- [ ] TM-03, Migrar a frota de `modules.veiculo` para `educa_transport_vehicles`, convertendo os indicadores de par de caracteres em booleano e preservando `passageiros`, `placa` e `malha`
- [ ] TM-04, Migrar os pontos de `modules.ponto_transporte_escolar` para `educa_transport_stops`, com conversão segura das coordenadas de texto para numérico e marcação dos pontos sem coordenada válida
- [ ] TM-05, Migrar as rotas de `modules.rota_transporte_escolar` para `educa_transport_routes`, preservando `ano`, `tipo_rota`, `km_pav`, `km_npav` e `tercerizado`
- [ ] TM-06, Migrar as pessoas de transporte de `modules.pessoa_transporte` para `educa_transport_students`, com vínculo da matrícula correspondente
- [ ] TM-07, Converter a coluna `pmieducar.aluno.veiculo_transporte_escolar` em vínculos com veículos reais, preservando o valor original quando não houver correspondência
- [ ] TM-08, Gerar o relatório de divergências da carga, com o total de registros marcados por tipo de inconsistência

---

## Ordem Sugerida

1. T-08, T-09, T-10, T-11 e T-12 primeiro, porque preservam o comportamento já em produção da exportação do Censo Escolar e qualquer regressão aí tem efeito imediato em dado oficial.
2. T-01 a T-07 em seguida, porque definem o esquema de dados do qual dependem as validações e os relatórios.
3. T-14, T-15 e T-16 depois do esquema, porque são regras que operam sobre as entidades já criadas.
4. T-17, T-18, T-19, T-20 e T-13 por último, porque expõem o que já está validado.
5. TM-01 a TM-08 somente depois de T-17 estar em ambiente de homologação, para que a carga possa ser conferida pela API nova.
6. Bloqueios: T-14 depende de T-03 e T-07; T-15 depende de T-01 e T-05; T-16 depende de T-02 e T-03; T-20 depende de T-04, T-05 e T-14.

---

## Lacunas Pendentes (🔴)

- A implementação servidora do módulo legado não está neste repositório: as regras de validação, unicidade, cascade e os campos reais das tabelas `modules.*` precisam ser levantadas no repositório legado antes de qualquer migração.
- O valor 3 de poder público responsável (compartilhado) do Registro 60 não existe no enum legado e precisa de decisão sobre como passar a ser gravado.
- O código 11 de tipologia modal ferroviário não tem flag na visão SQL do repositório e precisa de confirmação sobre a obrigação de exportação.
- A regra de lotação não existe no legado: é preciso decidir se a recusa de superlotação vale para todo tenant desde o primeiro dia ou entra em modo informativo.
- O significado dos campos `malha` e `tipo` do veículo precisa ser confirmado com a operação antes da migração dos valores.
- O serviço que preenche o endereço do ponto a partir do CEP precisa ser identificado, para definir o contrato e o comportamento de falha.
