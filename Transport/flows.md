# Transporte Escolar (i-Educar legado), Fluxos

> Fluxos da unit de transporte escolar que não cabem no `design.md`. O fluxo de malha e vinculação está em `_reversa_sdd/flowcharts/transport.md`.
> Confiança: 🟢 CONFIRMADO no código, 🟡 INFERIDO, 🔴 LACUNA.

---

## 1. Fluxo de cadastro da malha de transporte

**Gatilho:** o técnico de transporte inicia o cadastro pela intranet.

1. Abre a tela de empresa, motorista, veículo, ponto ou rota e preenche o formulário com a pessoa vinculada obtida por busca assíncrona. 🟢 `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Rota.js:79-99`
2. A busca dispara requisição ao endpoint de pessoa e preenche o identificador e o nome do campo. 🟢 `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Empresa.js:66-67`
3. O usuário grava; a resposta traz `any_error_msg` e as mensagens de retorno. 🟢 `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Rota.js:17-25`
4. Em caso de falha, o botão de gravação é reabilitado e as mensagens são exibidas; em caso de sucesso, o campo de nome é desabilitado e a tela redireciona para a página de detalhe após 500 milissegundos. 🟢 `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Rota.js:17-32`
5. O vínculo de pessoa fica travado, com a opção de editar a pessoa em nova aba. 🟢 `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Rota.js:17-19` e `:67-68`

---

## 2. Fluxo de preenchimento do endereço do ponto de parada

**Gatilho:** o técnico informa o CEP do ponto.

1. O sistema consulta o serviço de CEP e devolve logradouro, número, complemento, bairro, município e sigla da unidade federativa. 🟢 `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Ponto.js:40-46`
2. As coordenadas são preenchidas e o campo passa a somente leitura, com realce visual de campo desabilitado. 🟢 `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Ponto.js:37-38` e `:61-64`
3. A latitude e a longitude são armazenadas como texto no legado, o que impede verificação de faixa e comparação numérica. 🟢 `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Ponto.js:37-38`
4. Falha do serviço não tem tratamento observável: o campo permanece vazio e editável, sem mensagem. 🔴

---

## 3. Fluxo de vinculação do estudante à rota e ao ponto

**Gatilho:** o técnico abre a ficha do aluno e seleciona a rota de transporte.

1. A tela de pessoa de transporte carrega com a rota e o ponto já gravados. 🟢 `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Pessoatransporte.js:87-99`
2. Ao mudar a rota, o script dispara a consulta dos pontos da rota e, sem rota selecionada, exibe a mensagem `Selecione uma rota acima`. 🟢 `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Pessoatransporte.js:1-24`
3. O técnico escolhe o ponto de embarque e o turno e grava. 🟢 `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Pessoatransporte.js:99-103`
4. A gravação da API de aluno aciona `createOrUpdatePessoaTransporte`, que busca o identificador existente da pessoa de transporte, decide entre cadastrar ou editar e grava os vínculos de pessoa, destino, ponto, rota e observação. 🟢 `ieducar/modules/Api/Views/AlunoController.php:1779-1800`
5. A pessoa de transporte fica vinculada ao mesmo identificador de pessoa após o primeiro cadastro, e o identificador não muda mais. 🟢 `ieducar/modules/Api/Views/AlunoController.php:1792-1793`
6. Se a classe legada `clsModulesPessoaTransporte` não estiver disponível, a gravação é silenciosamente ignorada, sem erro para o usuário. 🟢 `ieducar/modules/Api/Views/AlunoController.php:1782-1784`

---

## 4. Fluxo de ativação e inativação de veículo

**Gatilho:** o técnico marca ou desmarca o indicador de ativo do veículo.

1. Ao carregar, o sistema compara o indicador gravado com o valor `N` e, nesse caso, exibe a linha de justificativa de inatividade já preenchida. 🟢 `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Veiculo.js:66-71`
2. Ao clicar no indicador, a linha de justificativa é mostrada ou escondida conforme o novo estado. 🟢 `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Veiculo.js:189-201`
3. A justificativa é gravada junto com a situação no mesmo recurso do veículo. 🟢 `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Veiculo.js:79`
4. Não há no legado verificação de que o veículo desativado não está vinculado a rota ativa. 🔴

---

## 5. Fluxo de exportação do Registro 60

**Gatilho:** a rotina de exportação do Censo Escolar é executada.

1. A visão do Registro 60 é consultada e materializa, por aluno, o transporte público, o poder público responsável e as flags de tipologia modal por teste de inclusão no array de tipos de veículo. 🟢 `database/sqls/views/public.educacenso_record60.sql:25-49`
2. A regra de exportação verifica o tipo de atendimento da turma, a mediação didática e o país de residência do aluno. 🟢 `src/Modules/Educacenso/ExportRule/TransporteEscolarPublico.php:23-26`
3. Se qualquer uma das três condições impedir o registro, a variável de transporte público é anulada no registro antes da gravação do arquivo. 🟢 `src/Modules/Educacenso/ExportRule/TransporteEscolarPublico.php:26-27`
4. A regra do tipo de transporte segue isolada do resto do registro e não consulta rota, ponto ou veículo. 🟢 `src/Modules/Educacenso/ExportRule/TransporteEscolarPublico.php:11-29`

---

## 6. Fluxo de vínculo de pessoa pela busca

**Gatilho:** o técnico digita no campo de nome da pessoa.

1. A cada interação, a tela consulta o endpoint de pessoa e preenche o identificador e o nome exibido. 🟢 `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Empresa.js:86-93`
2. Em registros existentes, o campo de nome é desabilitado para evitar troca acidental do vínculo. 🟢 `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Empresa.js:163`
3. Em registros novos, o campo mantém foco e o atalho de cadastrar pessoa é exibido. 🟢 `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Empresa.js:158-161`
4. A alteração de pessoa feita em janela de busca é propagada ao formulário após 500 milissegundos, com mensagem de sucesso. 🟢 `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Rota.js:115-128`

---

## 7. Fluxos ausentes no legado

Os fluxos abaixo aparecem no desenho do modelo novo, em `_reversa_sdd/flowcharts/transport.md` e em `_reversa_sdd/Transport/legacy-mapping.md`, e não têm implementação correspondente no código lido. Devem ser tratados como requisito novo, e não como reimplementação. 🔴

- Verificação de lotação antes da alocação, com alerta de superlotação. 🔴
- Vistoria semestral do DETRAN e situação de regularidade do veículo. 🔴
- Vigência de contrato da empresa de transporte. 🔴
- Credenciais do condutor exigidas pelo CTB, com curso do CONTRAN e exame toxicológico. 🔴
- Ordenação das paradas dentro da rota e traçado do itinerário em mapa. 🔴
- Cálculo de ocupação e de tempo médio de deslocamento. 🔴
- Pré-validação de consistência entre a alocação de transporte e o Registro 60. 🔴
