# Transporte Escolar (i-Educar legado)

> Unit do plano de extração do Reversa (`granularity = module`). Descreve o **QUE** o módulo de transporte escolar legado faz, com rastreabilidade ao código lido.
> Confiança: 🟢 CONFIRMADO no código, 🟡 INFERIDO, 🔴 LACUNA.

---

## Visão Geral

O módulo de transporte escolar do i-Educar cadastra a malha de transporte de estudantes da rede pública em seis entidades: empresa prestadora, motorista, veículo, ponto de parada, rota e pessoa de transporte. Ele se liga ao cadastro de aluno por três campos de resumo (tipo de transporte, rota de transporte e vehicle types) e alimenta a exportação do Censo Escolar, Registro 60, com a declaração de transporte público, o poder público responsável e a tipologia modal. 🟢

Problema que resolve: garantir o registro e a rastreabilidade dos estudantes e das linhas que os transportam, de forma a atender ao repasse de recursos do PNATE e ao Registro 60 do Censo Escolar. 🟢

Observação estrutural: a implementação servidora do módulo legado (`modules.empresa_transporte_escolar`, `modules.motorista`, `modules.veiculo`, `modules.ponto_transporte_escolar`, `modules.rota_transporte_escolar`, `modules.pessoa_transporte`) **não está presente neste repositório**. O que resta é a camada de apresentação em JavaScript legado, os pontos de integração com o cadastro de aluno e com a exportação do Censo. 🔴

---

## Responsabilidades

- Registrar a empresa prestadora de transporte escolar ou a frota municipal própria, com responsável legal e observações. 🟢
- Registrar o motorista ou condutor, com CNH, categoria, data de habilitação, vencimento e empresa de vínculo. 🟢
- Registrar a frota de veículos, com placa, renavam, licença, chassi, marca, anos, lotação, malha, tipo, exclusividade, acessibilidade, condutor, empresa e situação. 🟢
- Registrar pontos de parada com endereço e coordenadas geográficas. 🟢
- Registrar rotas por ano, tipo, extensão pavimentada e não pavimentada, tercerização, empresa e escola de destino. 🟢
- Vincular o estudante à rota e ao ponto de embarque, com a escola de destino e a observação. 🟢
- Disponibilizar ao aluno o resumo de tipo de transporte, rota de transporte, transporte rural e tipos de veículo. 🟢
- Fornecer ao Censo Escolar os campos de transporte público, poder público responsável e tipologia modal. 🟢

---

## Regras de Negócio

- O tipo de transporte do aluno é normalizado por `TransportationProvider`: `municipal` para 2, `estadual` para 1 e qualquer outro valor para 0 (não utiliza). 🟢 `app/Models/TransportationProvider.php:9-13` e `app/Models/TransportationProvider.php:32-36`
- A API de aluno aceita apenas os valores literais `nenhum`, `municipal` e `estadual` para o campo `tipo_transporte`. 🟢 `ieducar/modules/Api/Views/AlunoController.php:102-109`
- O enum legado de tipo de transporte **não cobre o valor 3 (compartilhado)** previsto no Registro 60 do Censo Escolar; qualquer valor fora de `nenhum`, `municipal` e `estadual` é convertido em 0. 🟢 `app/Models/TransportationProvider.php:9-14`
- Na visão do Registro 60, o campo `transportePublico` vale 1 quando `tipo_transporte` é maior que zero e mantém o próprio `tipo_transporte` nos demais casos. 🟢 `database/sqls/views/public.educacenso_record60.sql:25-26`
- O campo `poderPublicoResponsavelTransporte` do Registro 60 é preenchido diretamente com o `tipo_transporte` do aluno. 🟢 `database/sqls/views/public.educacenso_record60.sql:27`
- O tipo de veículo de transporte escolar do aluno é um array PostgreSQL de códigos INEP e é lido como lista de flags por código na visão do Registro 60: 1 van, 2 micro-ônibus, 3 ônibus, 4 bicicleta, 5 tração animal, 6 outro, 7 aquaviário até 5, 8 aquaviário de 5 a 15, 9 aquaviário de 15 a 35, 10 aquaviário acima de 35. 🟢 `database/sqls/views/public.educacenso_record60.sql:28-37`
- Na API de aluno, a lista de tipos de veículo chega como array e é gravada como texto separado por vírgula, removendo os elementos vazios. 🟢 `ieducar/modules/Api/Views/AlunoController.php:651-657`
- Na saída da API de aluno, `utiliza_transporte_rural` é convertida para 1 ou 0 e `veiculo_transporte_escolar` é convertida do array PostgreSQL para array PHP. 🟢 `ieducar/modules/Api/Views/AlunoController.php:1221-1223`
- A regra de exportação do Registro 60 anula a variável de transporte público quando a turma não possui atendimento curricular, quando a mediação didática não é presencial nem semipresencial ou quando o país de residência do aluno não é o Brasil. 🟢 `src/Modules/Educacenso/ExportRule/TransporteEscolarPublico.php:23-27`
- O veículo registra os indicadores `exclusivo_transporte_escolar` e `adaptado_necessidades_especiais` com os valores de par de caracteres `S` e `N`. 🟢 `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Veiculo.js:57-63`
- O veículo registra a situação `ativo` com `S` e `N` e um texto `descricao_inativo` que só é exibido quando o veículo está inativo. 🟢 `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Veiculo.js:66-71` e `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Veiculo.js:189-201`
- A pessoa de transporte guarda a pessoa, a pessoa jurídica de destino, o ponto de transporte escolar, a rota de transporte escolar e a observação. 🟢 `ieducar/modules/Api/Views/AlunoController.php:1789-1797`
- Ao trocar a rota na tela de pessoa de transporte, a lista de pontos é recarregada a partir da rota selecionada pelo endpoint `ponto_xml.php?rota=`. 🟢 `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Pessoatransporte.js:1-24`
- A rota registra o ano, o tipo de rota, a extensão pavimentada e não pavimentada e a marca de tercerização com `S` e `N`. 🟢 `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Rota.js:49-57`
- O ponto de parada recebe latitude e longitude em campo somente leitura, preenchido a partir do CEP informado. 🟢 `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Ponto.js:37-38` e `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Ponto.js:61-64`
- O motorista registra CNH, categoria, data de habilitação, vencimento da CNH e empresa de transporte. 🟢 `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Motorista.js:46-54`
- O cadastro de empresa registra a pessoa jurídica responsável e a observação. 🟢 `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Empresa.js:46-50`
- Não existe, no código legado, verificação de lotação, controle de validade de contrato de empresa, registro de vistoria do DETRAN, ordenação de paradas na rota nem cálculo de ocupação. 🔴
- Não existe, no código legado, ordenação de pontos dentro da rota: o vínculo entre rota e ponto é feito por referência simples, sem posição. 🔴
- O método legado que grava a pessoa de transporte está marcado com TODO de remoção futura e depende da classe `clsModulesPessoaTransporte`, ausente deste repositório. 🟢 `ieducar/modules/Api/Views/AlunoController.php:1779-1784`

---

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|-----------|-------------------|
| RF-01 | O sistema deve registrar a empresa prestadora de transporte escolar com pessoa jurídica responsável e observação, permitindo o vínculo de entidades de frota e condutores. | Must | Dado um formulário de empresa com pessoa jurídica válida, quando o usuário gravar, então a empresa é criada e o detalhe é exibido em `transporte_empresa_det.php` com o identificador gerado. |
| RF-02 | O sistema deve registrar o motorista com pessoa, CNH, categoria, data de habilitação, vencimento da CNH e empresa de vínculo. | Must | Dado um formulário de motorista completo, quando o usuário gravar, então os seis campos são persistidos e reaparecem preenchidos na edição. |
| RF-03 | O sistema deve registrar o veículo com identificação, anos, lotação, malha, tipo, exclusividade, acessibilidade, condutor e empresa, mantendo a situação ativa ou inativa com justificativa. | Must | Dado um veículo inativo, quando o usuário abrir o formulário, então a linha de descrição de inatividade fica visível e o demais permanece preenchido. |
| RF-04 | O sistema deve registrar o ponto de parada com endereço completo, município e coordenadas geográficas preenchidas a partir do CEP. | Must | Dado um CEP válido, quando o usuário o informar, então logradouro, bairro, município e as coordenadas são preenchidos e as coordenadas ficam somente leitura. |
| RF-05 | O sistema deve registrar a rota com descrição, escola de destino, empresa, ano, tipo, extensão pavimentada, extensão não pavimentada e marca de tercerização. | Must | Dado um formulário de rota completo, quando o usuário gravar, então o detalhe é exibido em `transporte_rota_det.php` com os valores informados. |
| RF-06 | O sistema deve vincular a pessoa de transporte à rota, ao ponto de embarque, à pessoa jurídica de destino e à observação. | Must | Dado um aluno com rota e ponto informados, quando o cadastro for gravado, então a pessoa de transporte é criada ou atualizada com os quatro vínculos. |
| RF-07 | O sistema deve recarregar a lista de pontos disponíveis sempre que a rota da pessoa de transporte for alterada. | Must | Dado o usuário na tela de pessoa de transporte, quando ele trocar a rota, então a lista de pontos passa a conter somente os pontos da rota selecionada. |
| RF-08 | O sistema deve registrar no aluno o tipo de transporte, a rota de transporte e a indicação de transporte rural, normalizando o tipo para o domínio de valores aceito. | Must | Dado o tipo `municipal`, quando o aluno for gravado, então `tipo_transporte` fica 2; dado um valor fora do conjunto aceito, então fica 0. |
| RF-09 | O sistema deve registrar a lista de tipos de veículo de transporte escolar do aluno e convertê-la no formato de array esperado pelo banco. | Must | Dado um array com os valores 1 e 3, quando o aluno for gravado, então o campo é persistido como `1,3` e lido de volta como array com esses dois elementos. |
| RF-10 | O sistema deve fornecer na visão do Registro 60 os campos de transporte público, poder público responsável e as flags de tipologia modal por código INEP. | Must | Dado um aluno com `tipo_transporte` igual a 2 e veículo do tipo 3, quando a visão do Registro 60 for consultada, então `transportePublico` vale 1, `poderPublicoResponsavelTransporte` vale 2 e `veiculoTransporteOnibus` vale 1. |
| RF-11 | O sistema deve anular a informação de transporte público no Registro 60 quando a turma não possui atendimento curricular, quando a mediação não é presencial nem semipresencial ou quando a residência do aluno não é no Brasil. | Must | Dado um aluno transportado em turma sem atendimento curricular, quando a exportação for gerada, então a variável de transporte público fica nula. |
| RF-12 | O sistema deve validar a presença e o domínio do valor de tipo de transporte na API de aluno. | Must | Dado um payload com `tipo_transporte` igual a `federal`, quando a requisição for validada, então a requisição é rejeitada com erro no campo. |

---

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência no código | Confiança |
|------|--------------------|---------------------|-----------|
| Segurança | A API de aluno impõe autorização de leitura, criação e alteração por perfil de usuário antes de gravar. | `ieducar/modules/Api/Views/AlunoController.php:213` (`canChange`), `:222` (`canPost`), `:229` (`canPut`) | 🟢 |
| Segurança | A gravação do aluno registra o usuário executor em `ref_usuario_exc`. | `ieducar/modules/Api/Views/AlunoController.php:1809` | 🟢 |
| Integridade | A unicidade do aluno é verificada por pessoa, código Inep e código do estado antes da gravação. | `ieducar/modules/Api/Views/AlunoController.php:112`, `:125`, `:149` | 🟢 |
| Isolamento | O sistema legado opera em base municipal única, sem isolamento por tenant; a migração para o SYSGOV exige `tenant_id` em todas as entidades do módulo. | `ieducar/intranet/include/pmieducar/clsPmieducarAluno.inc.php` | 🟡 |
| Performance | Não há cache, fila ou índice dedicado para as consultas de transporte no código lido; a listagem de pontos por rota usa endpoint dedicado. | `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Pessoatransporte.js:24` | 🟡 |
| Disponibilidade | Não há mecanismo de repetição, circuit breaker ou degradação aplicada às chamadas do módulo. | ausência de evidência no código lido | 🔴 |
| Compatibilidade | A camada de apresentação depende de jQuery e do `getResourceUrlBuilder`, o que restringe a migração da interface. | `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Rota.js:79-92` | 🟢 |

> Inferido a partir do código. Validar com equipe de operações.

---

## Critérios de Aceitação

```gherkin
Dado uma empresa de transporte com pessoa jurídica cadastrada
Quando o técnico de transporte grava o cadastro
Então a empresa é persistida e o detalhe é aberto com o novo identificador

Dado um veículo com situação inativa e texto de justificativa
Quando o técnico de transporte abre o formulário do veículo
Então a linha da justificativa de inatividade fica visível

Dado um ponto de parada com CEP válido
Quando o técnico de transporte informa o CEP
Então o endereço e as coordenadas são preenchidos e as coordenadas ficam somente leitura

Dado uma pessoa de transporte com rota selecionada
Quando o técnico de transporte troca a rota
Então a lista de pontos é recarregada com os pontos da nova rota

Dado um aluno com tipo de transporte "municipal" e veículo do tipo 3
Quando o cadastro do aluno for gravado
Então tipo_transporte vale 2 e veiculo_transporte_escolar preserva o código 3

Dado um aluno transportado em turma sem atendimento curricular
Quando a exportação do Registro 60 for gerada
Então a variável de transporte público fica nula

Dado um payload de aluno com tipo de transporte "federal"
Quando a requisição de gravação for validada
Então a requisição é rejeitada com erro no campo tipo_transporte
```

---

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| Registro de empresa, motorista, veículo, ponto e rota | Must | Cadastros sem os quais não existe malha de transporte nem vínculo de aluno |
| Vínculo da pessoa de transporte ao aluno | Must | É o que produz o número de aluno transportado usado no PNATE e no Registro 60 |
| Campos de tipo de transporte e veículo de transporte escolar do aluno | Must | Insumo direto do Registro 60 |
| Regra de anulação da exportação do Registro 60 | Must | Regra de negócio já em produção, sem caminho alternativo |
| Preenchimento automático do endereço do ponto a partir do CEP | Should | Importante, com alternativa de digitação manual |
| Recarregamento da lista de pontos por rota | Should | Evita vínculo de ponto de outra rota, com alternativa de busca |
| Autorização e registro do usuário executor | Must | Sem trilha de autoria o dado de transporte não é auditável |
| Verificação de lotação | Could | Ausente no legado e tratada como componente futuro no modelo novo |
| Validação de vigência de contrato e de vistoria do DETRAN | Could | Ausente no legado e tratada como componente futuro no modelo novo |

> Prioridade inferida por frequência de chamada e posição na cadeia de dependências.

---

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Empresa.js` | `resourceOptions.handleGet` e `handlePost` do cadastro de empresa | 🟢 |
| `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Motorista.js` | `resourceOptions.handleGet` e `handlePost` do cadastro de motorista | 🟢 |
| `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Veiculo.js` | `resourceOptions.handleGet` e `handlePost` do cadastro de veículo | 🟢 |
| `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Ponto.js` | `resourceOptions.handleGet` e `handlePost` do cadastro de ponto | 🟢 |
| `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Rota.js` | `resourceOptions.handleGet` e `handlePost` do cadastro de rota | 🟢 |
| `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Pessoatransporte.js` | `handleGet` da pessoa de transporte e recarga de pontos por rota | 🟢 |
| `ieducar/modules/Api/Views/AlunoController.php` | `validatesTransporte`, `createOrUpdateAluno`, `createOrUpdatePessoaTransporte` | 🟢 |
| `app/Models/TransportationProvider.php` | `TransportationProvider::from` e `getDescriptiveValues` | 🟢 |
| `src/Modules/Educacenso/ExportRule/TransporteEscolarPublico.php` | `TransporteEscolarPublico::handle` | 🟢 |
| `src/Modules/Educacenso/Model/VeiculoTransporteEscolar.php` | `VeiculoTransporteEscolar` (tipologia modal) | 🟢 |
| `database/sqls/views/public.educacenso_record60.sql` | Visão do Registro 60 com as flags de transporte | 🟢 |
| `ieducar/lib/Portabilis/View/Helper/DynamicInput/Rotas.php` | Helper de consulta de rotas por escola | 🟢 |
| `ieducar/lib/Portabilis/View/Helper/Input/Resource/SimpleSearchEmpresa.php` | Busca simples de empresa | 🟢 |
| `ieducar/lib/Portabilis/View/Helper/Input/Resource/SimpleSearchMotorista.php` | Busca simples de motorista | 🟢 |
| `ieducar/lib/Portabilis/View/Helper/Input/Resource/SimpleSearchPonto.php` | Busca simples de ponto | 🟢 |
| `ieducar/lib/Portabilis/View/Helper/Input/Resource/SimpleSearchRota.php` | Busca simples de rota | 🟢 |
| `database/migrations/legacy/2020_01_01_110000_create_pmieducar_aluno_table.php` | Colunas de transporte na tabela de aluno | 🟢 |
| `ieducar/modules/DynamicInput/Views/RotasController.php` | Consulta dinâmica de rotas | 🟢 |
| `ieducar/modules/DynamicInput/Views/EscolaDestinoTransporteEscolarController.php` | Consulta de escola de destino de transporte | 🟢 |
| `src/Modules/Educacenso/Data/Registro60.php` | Estrutura do registro 60 do Censo | 🟢 |
| `modules.empresa_transporte_escolar` (tabela legada) | Entidade legada de empresa | 🔴 |
| `modules.motorista` (tabela legada) | Entidade legada de motorista | 🔴 |
| `modules.veiculo` (tabela legada) | Entidade legada de veículo | 🔴 |
| `modules.ponto_transporte_escolar` (tabela legada) | Entidade legada de ponto | 🔴 |
| `modules.rota_transporte_escolar` (tabela legada) | Entidade legada de rota | 🔴 |
| `modules.pessoa_transporte` (tabela legada) | Entidade legada de pessoa de transporte | 🔴 |
