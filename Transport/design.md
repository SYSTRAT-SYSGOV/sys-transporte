# Transporte Escolar (i-Educar legado), Design Técnico

> Descreve o **COMO** o módulo de transporte escolar legado é construído, com base no código lido.
> Confiança: 🟢 CONFIRMADO no código, 🟡 INFERIDO, 🔴 LACUNA.

---

## Interface

### Entidades do domínio legado

| Entidade | Chave | Atributos observados | Fonte |
|----------|-------|----------------------|-------|
| Empresa de transporte | `cod_empresa_transporte_escolar` | pessoa jurídica (`pessoaj`), observacao | `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Empresa.js:46-50` |
| Motorista | `cod_motorista` | pessoa, `cnh`, `tipo_cnh`, `dt_habilitacao`, `vencimento_cnh`, `ref_cod_empresa_transporte_escolar`, observacao | `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Motorista.js:46-54` |
| Veículo | `cod_veiculo` | `descricao`, `placa`, `renavam`, `data_licenca`, `chassi`, `marca`, `ano_fabricacao`, `ano_modelo`, `passageiros`, `malha`, `tipo`, `exclusivo_transporte_escolar`, `adaptado_necessidades_especiais`, `ativo`, `descricao_inativo`, `motorista`, `empresa`, observacao | `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Veiculo.js:46-82` |
| Ponto de parada | `cod_ponto_transporte_escolar` | `desc`, `cep`, `logradouro`, `numero`, `complemento`, `bairro`, `idmun`, `municipio`, `sigla_uf`, `latitude`, `longitude` | `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Ponto.js:32-46` |
| Rota | `cod_rota_transporte_escolar` | `desc`, `ref_idpes_destino`, `ref_cod_empresa_transporte_escolar`, `ano`, `tipo_rota`, `km_pav`, `km_npav`, `tercerizado` | `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Rota.js:43-57` |
| Pessoa de transporte | `cod_pessoa_transporte` | `ref_idpes`, `ref_idpes_destino`, `ref_cod_ponto_transporte_escolar`, `ref_cod_rota_transporte_escolar`, `observacao` | `ieducar/modules/Api/Views/AlunoController.php:1789-1797` |

### Campos de transporte no aluno

| Campo | Tipo | Conversão observada | Fonte |
|-------|------|---------------------|-------|
| `tipo_transporte` | smallint | `municipal` para 2, `estadual` para 1, demais para 0 | `app/Models/TransportationProvider.php:32-36` |
| `rota_transporte` | inteiro | Gravado como recebido | `ieducar/modules/Api/Views/AlunoController.php:678` |
| `utiliza_transporte_rural` | booleano | Convertido para booleano na escrita e para 1 ou 0 na leitura | `ieducar/modules/Api/Views/AlunoController.php:679` e `:1221` |
| `veiculo_transporte_escolar` | array PostgreSQL | Array PHP serializado por vírgula na escrita, lido do array do banco na leitura | `ieducar/modules/Api/Views/AlunoController.php:651-657` e `:1223` |

### Endpoints HTTP

| Método | Caminho | Entrada | Saída | Status codes |
|--------|---------|---------|-------|--------------|
| GET | `/module/Api/pessoa` | `id` | Objeto de pessoa com `id`, `nome`, `msgs`, `aluno_id` | 200, 404 |
| POST | `/intranet/transporte_rota_det.php` | `cod_rota` | Página de detalhe da rota | 200, 302 |
| POST | `/intranet/transporte_empresa_det.php` | `cod_empresa` | Página de detalhe da empresa | 200, 302 |
| POST | `/intranet/transporte_motorista_det.php` | `cod_motorista` | Página de detalhe do motorista | 200, 302 |
| POST | `/intranet/transporte_veiculo_det.php` | `cod_veiculo` | Página de detalhe do veículo | 200, 302 |
| POST | `/intranet/transporte_ponto_det.php` | `cod_ponto` | Página de detalhe do ponto | 200, 302 |
| POST | `/intranet/transporte_pessoa_det.php` | `cod_pt` | Página de detalhe da pessoa de transporte | 200, 302 |
| GET | `ponto_xml.php` | `rota` | XML com os pontos da rota | 200 |
| POST | API de aluno | `tipo_transporte`, `rota_transporte`, `utiliza_transporte_rural`, `veiculo_transporte_escolar`, `transporte_rota`, `transporte_ponto`, `transporte_observacao`, `pessoaj_id` | Aluno gravado com `id` | 200, 422 |

### Funções e classes

| Símbolo | Assinatura | Retorno | Observação |
|---------|-----------|---------|------------|
| `TransportationProvider::from` | `(int|string $value): int` | `int` | Normaliza o tipo de transporte do aluno; valor fora do domínio vira 0 |
| `TransportationProvider::getDescriptiveValues` | `(): array<int,string>` | `array` | Rótulos `Não utiliza`, `Estadual`, `Municipal` |
| `TransportationProvider::getValueDescription` | `(int $value): string` | `string` | Tradução inversa para `nenhum`, `estadual`, `municipal` |
| `TransporteEscolarPublico::handle` | `(RegistroEducacenso $registro60): RegistroEducacenso` | `RegistroEducacenso` | Anula `transportePublico` conforme tipo de atendimento, mediação e residência |
| `AlunoController::validatesTransporte` | `(): bool` | `bool` | Exige presença e domínio de `tipo_transporte` |
| `AlunoController::createOrUpdatePessoaTransporte` | `(int $ref_idpes)` | `array` ou `null` | Cria ou edita a pessoa de transporte; retorna vazio se a classe legada não existir |
| `AlunoController::createOrUpdateAluno` | `(int $id = null)` | `bool` | Grava os campos de transporte do aluno |
| `clsModulesPessoaTransporte::detalhe` | `(): array` | `array` | Retorna `cod_pessoa_transporte` da pessoa; classe ausente neste repositório 🔴 |

---

## Fluxo Principal

1. O técnico de transporte cadastra a empresa prestadora com a pessoa jurídica responsável e a observação. `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Empresa.js:46-50`
2. O técnico cadastra o motorista com CNH, categoria, habilitação, vencimento e empresa de vínculo. `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Motorista.js:46-54`
3. O técnico cadastra o veículo com identificação, lotação, tipo, malha, exclusividade, acessibilidade, condutor padrão e empresa. `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Veiculo.js:46-82`
4. O técnico cadastra o ponto de parada; o endereço e as coordenadas são preenchidos a partir do CEP e as coordenadas ficam somente leitura. `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Ponto.js:37-46` e `:61-64`
5. O técnico cadastra a rota com escola de destino, empresa, ano, tipo, extensões e marca de tercerização. `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Rota.js:43-57`
6. O técnico abre a ficha do aluno, seleciona a rota e o ponto de embarque; a lista de pontos é recarregada conforme a rota escolhida. `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Pessoatransporte.js:1-24`
7. A gravação do aluno chama `createOrUpdatePessoaTransporte`, que cria ou atualiza a pessoa de transporte com os vínculos de pessoa, destino, ponto, rota e observação. `ieducar/modules/Api/Views/AlunoController.php:1779-1800`
8. No ciclo do Censo Escolar, a regra de exportação anula a declaração de transporte público quando a turma, a mediação ou a residência impedem o registro. `src/Modules/Educacenso/ExportRule/TransporteEscolarPublico.php:23-27`

---

## Fluxos Alternativos

- **Gravação com erro de validação:** quando a resposta do recurso traz `any_error_msg`, o botão de gravação é reabilitado e o usuário permanece na tela. `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Rota.js:21-24`
- **Gravação com sucesso:** o formulário desabilita o campo de nome e redireciona para a página de detalhe após 500 milissegundos. `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Rota.js:17-25`
- **Consulta de pessoa pelo campo de nome:** a digitação no campo de nome dispara a busca de pessoa no endpoint de API e preenche os identificadores. `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Rota.js:79-99`
- **Edição de pessoa pela tela de transporte:** o formulário abre a ficha da pessoa em nova aba. `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Rota.js:67-68`
- **Troca de rota na pessoa de transporte:** a mudança dispara a requisição de pontos da rota e a mensagem de seleção quando não há rota escolhida. `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Pessoatransporte.js:1-24`
- **Veículo inativo:** o campo de justificativa de inatividade é exibido apenas quando o indicador de ativo está desmarcado. `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Veiculo.js:189-201`
- **Classe legada ausente:** `createOrUpdatePessoaTransporte` retorna sem gravar quando a classe `clsModulesPessoaTransporte` não está disponível. `ieducar/modules/Api/Views/AlunoController.php:1782-1784`
- **Valor de tipo de transporte fora do domínio:** a validação rejeita o payload; na gravação direta, o valor é normalizado para 0. `ieducar/modules/Api/Views/AlunoController.php:102-109` e `app/Models/TransportationProvider.php:32-36`

---

## Dependências

- **Cadastro de pessoas (`pmieducar.pessoa`, `core_people` no alvo):** todas as entidades do módulo referenciam a pessoa, e a empresa referencia a pessoa jurídica. `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Empresa.js:49-50`
- **Cadastro de aluno (`pmieducar.aluno`):** recebe os campos de transporte e é a origem da pessoa de transporte. `ieducar/modules/Api/Views/AlunoController.php:677-679`
- **Módulo de escola:** a rota referencia a escola de destino. `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Rota.js:45-46`
- **Módulo de Censo Escolar:** consome a visão do Registro 60 e aplica a regra de anulação. `src/Modules/Educacenso/ExportRule/TransporteEscolarPublico.php:16-29`
- **Serviço de CEP e georreferenciamento:** preenche endereço e coordenadas do ponto de parada. `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Ponto.js:37-46`
- **Controlador AJAX legado (`getResource`, `getResourceUrlBuilder`):** base das telas de cadastro do módulo. `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Rota.js:79-92`
- **jQuery:** base da camada de apresentação do módulo. `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Veiculo.js:189-201`

---

## Decisões de Design Identificadas

| Decisão | Evidência no código | Confiança |
|---------|---------------------|-----------|
| Persistência das entidades de transporte em tabelas legadas `modules.*`, fora dos schemas de negócio do i-Educar | `ieducar/modules/Api/Views/AlunoController.php:1786` (`clsModulesPessoaTransporte`) | 🟢 |
| Persistência dos campos de transporte do aluno em colunas da tabela `pmieducar.aluno`, com o tipo de veículo em array PostgreSQL | `database/migrations/legacy/2020_01_01_110000_create_pmieducar_aluno_table.php` e `ieducar/modules/Api/Views/AlunoController.php:651-657` | 🟢 |
| Tabelas de transporte fora do modelo multi-tenant, em base municipal única | `ieducar/intranet/include/pmieducar/clsPmieducarAluno.inc.php` | 🟡 |
| Uso de flags de par de caracteres `S` e `N` para indicadores booleanos de veículo | `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Veiculo.js:57-63` | 🟢 |
| Serialização da lista de tipos de veículo como texto separado por vírgula, com leitura por conversor de array PostgreSQL | `ieducar/modules/Api/Views/AlunoController.php:651-657` e `:1223` | 🟢 |
| Exportação do Censo Escolar por visão SQL que materializa as flags de tipologia modal por teste de inclusão no array | `database/sqls/views/public.educacenso_record60.sql:28-37` | 🟢 |
| Regras de exportação implementadas como classes de regra por registro, com interface de contrato comum | `src/Modules/Educacenso/ExportRule/TransporteEscolarPublico.php:11` (`implements EducacensoExportRule`) | 🟢 |
| Formulários de transporte dependentes de pessoa por busca assíncrona, com desabilitamento do campo após vínculo | `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Rota.js:17-18` e `:158-163` | 🟢 |
| Ordem das paradas não modelada: a rota e o ponto se referenciam sem posição | ausência de campo de ordem em `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Rota.js:43-57` | 🟢 |
| Enriquecimento de endereço do ponto por CEP, com coordenadas somente leitura | `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Ponto.js:37-46` e `:61-64` | 🟡 |

---

## Estado Interno

O módulo legado é **sem estado próprio**: cada entidade é uma linha em tabela e a consistência entre rota, ponto, pessoa de transporte e aluno é mantida apenas por referências entre colunas, sem regra de integridade declarada no código lido. 🟢

Campos de estado observados:

- `ativo` e `descricao_inativo` no veículo, que representa a desativação lógica com justificativa. 🟢 `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Veiculo.js:66-79`
- `tercerizado` na rota, que indica contratação de terceiro. 🟢 `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Rota.js:54-57`
- `utiliza_transporte_rural` no aluno, que marca o estudante servido em área rural para efeito do PNATE. 🟢 `ieducar/modules/Api/Views/AlunoController.php:679`
- `malha` e `tipo` no veículo, que descrevem a rede viária atendida e a categoria do equipamento. 🟢 `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Veiculo.js:55-56`
- `exclusivo_transporte_escolar` e `adaptado_necessidades_especiais` no veículo, que são as duas informações de conformidade e de acessibilidade hoje disponíveis. 🟢 `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Veiculo.js:57-63`

Não há, no legado, registro de histórico, de vigência contratual, de vistoria ou de credencial de condutor com validade. 🔴

---

## Observabilidade

- Mensagens de retorno do servidor consumidas por `handleMessages(dataResponse.msgs)` em todas as telas do módulo, com destaque de erro em `resource-notice`. 🟢 `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Rota.js:6-13` e `:35`
- Mensagem de sucesso exibida após alteração de pessoa vinculada. 🟢 `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Rota.js:120`
- Flag `any_error_msg` usada como indicador de falha na gravação. 🟢 `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Rota.js:21-24`
- Registro do usuário executor na gravação de aluno, em `ref_usuario_exc`. 🟢 `ieducar/modules/Api/Views/AlunoController.php:1809`
- Mensagem de validação do módulo de Censo concatena as mensagens de regra e as mensagens do registro. 🟢 `src/Modules/Educacenso/ExportRule/TransporteEscolarPublico.php:16-29`
- Não há log estruturado, métrica ou rastreamento distribuído no módulo legado. 🔴

---

## Riscos e Lacunas

- 🔴 A implementação servidora do módulo não está neste repositório: as classes `clsModules*` de transporte e as páginas `transporte_*` do intranet não foram encontradas. As regras de validação, unicidade e cascade do legado só podem ser inferidas pelos artefatos de apresentação.
- 🔴 Não há evidência de regra de lotação no legado. O fluxo de superlotação descrito em `_reversa_sdd/flowcharts/transport.md` e em `_reversa_sdd/Transport/legacy-mapping.md` descreve o modelo alvo, não o comportamento existente.
- 🔴 Não há no legado vigência de contrato de empresa, registro de vistoria do DETRAN, credencial de curso do CONTRAN nem exame toxicológico, embora o CTB os exija. A modelagem nova os introduz como requisito novo.
- 🔴 O valor 3 de poder público responsável, previsto no Registro 60 como compartilhado, não existe no enum legado e é convertido em 0 (não utiliza), o que produz declaração incorreta na exportação.
- 🔴 O valor 11 de tipologia modal ferroviário aparece na especificação do Registro 60 mas não tem flag na visão SQL do repositório.
- 🟡 O preenchimento automático do endereço do ponto a partir do CEP depende de serviço externo não identificado no código lido.
- 🟡 O significado exato de `malha` e de `tipo` no veículo não está documentado no código e foi inferido pelo contexto de rota rural e urbana.
- 🟡 A ordem de atendimento das paradas dentro da rota é mantida fora do banco, o que impede a reprodução do itinerário e a apuração de tempo de deslocamento.
- 🟡 A correlação entre a rota realmente usada pelo estudante e o campo `rota_transporte` do aluno não é garantida pelo código, porque ambos são gravados por caminhos independentes.
