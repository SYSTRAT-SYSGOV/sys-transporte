# Transporte Escolar (i-Educar legado), Contratos

> Contratos externos observados no legado para a unit de transporte escolar. Serve de entrada para o `openapi/` do modelo novo.
> Confiança: 🟢 CONFIRMADO no código, 🟡 INFERIDO, 🔴 LACUNA.

---

## 1. Contrato de tela (legado intranet)

| Método | Caminho | Entrada | Saída | Observação |
|--------|---------|---------|-------|------------|
| GET | `/intranet/transporte_empresa_det.php?cod_empresa={id}` | `cod_empresa` | Página HTML de detalhe da empresa | Redirecionamento após gravação 🟢 `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Empresa.js:25` |
| GET | `/intranet/transporte_motorista_det.php?cod_motorista={id}` | `cod_motorista` | Página HTML de detalhe do motorista | 🟢 `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Motorista.js:24` |
| GET | `/intranet/transporte_veiculo_det.php?cod_veiculo={id}` | `cod_veiculo` | Página HTML de detalhe do veículo | 🟢 `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Veiculo.js:24` |
| GET | `/intranet/transporte_ponto_det.php?cod_ponto={id}` | `cod_ponto` | Página HTML de detalhe do ponto | 🟢 `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Ponto.js:15` |
| GET | `/intranet/transporte_rota_det.php?cod_rota={id}` | `cod_rota` | Página HTML de detalhe da rota | 🟢 `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Rota.js:22` |
| GET | `/intranet/transporte_pessoa_det.php?cod_pt={id}` | `cod_pt` | Página HTML de detalhe da pessoa de transporte | 🟢 `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Pessoatransporte.js:74` |

---

## 2. Contrato JSON de recurso (legado AJAX)

Todas as telas do módulo usam o mesmo envelope de resposta, tratado por `handleMessages`, `resourceOptions.handleGet`, `handlePost` e `handlePut`. 🟢 `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Rota.js:17-59`

```json
{
  "id": 123,
  "any_error_msg": false,
  "msgs": [
    { "tipo": "erro", "texto": "mensagem" }
  ],
  "pessoa": {
    "id": 456,
    "nome": "Nome da pessoa",
    "aluno_id": 789
  }
}
```

| Campo | Tipo | Uso observado |
|-------|------|---------------|
| `id` | inteiro | Identificador da entidade em edição 🟢 `Rota.js:43` |
| `any_error_msg` | booleano | Sinaliza falha da gravação e reabre o botão de salvar 🟢 `Rota.js:21-24` |
| `msgs` | array | Mensagens exibidas ao usuário 🟢 `Rota.js:35` |
| `pessoa` | objeto | Pessoa vinculada, com `id`, `nome` e `aluno_id` 🟢 `Rota.js:40-41` |

---

## 3. Contrato por entidade

### 3.1 Empresa de transporte 🟢 `Empresa.js:46-50`

| Campo | Formato legado | Observação |
|-------|-----------------|------------|
| `id` | inteiro | Identificador da empresa |
| `pessoaj` | inteiro | Pessoa jurídica responsável |
| `pessoajnome` | texto | Razão social exibida no campo de seleção |
| `observacao` | texto | Observação livre |

### 3.2 Motorista 🟢 `Motorista.js:45-54`

| Campo | Formato legado | Observação |
|-------|-----------------|------------|
| `id` | inteiro | Identificador do motorista |
| `cnh` | texto | Número da CNH |
| `tipo_cnh` | texto | Categoria de habilitação |
| `dt_habilitacao` | data | Data de habilitação |
| `vencimento_cnh` | data | Vencimento da CNH |
| `ref_cod_empresa_transporte_escolar` | inteiro | Empresa de vínculo |
| `empresa` | texto | Razão social exibida no campo de seleção |
| `observacao` | texto | Observação livre |

### 3.3 Veículo 🟢 `Veiculo.js:45-82`

| Campo | Formato legado | Observação |
|-------|-----------------|------------|
| `id` | inteiro | Identificador do veículo |
| `descricao` | texto | Descrição do veículo |
| `placa` | texto | Placa |
| `renavam` | texto | Registro nacional de veículos |
| `data_licenca` | data | Data da licença |
| `chassi` | texto | Chassi |
| `marca` | texto | Marca e modelo |
| `ano_fabricacao` | inteiro | Ano de fabricação |
| `ano_modelo` | inteiro | Ano de modelo |
| `passageiros` | inteiro | Lotação |
| `malha` | texto | Malha atendida |
| `tipo` | texto | Tipo do veículo |
| `exclusivo_transporte_escolar` | `S` ou `N` | Exclusividade de uso |
| `adaptado_necessidades_especiais` | `S` ou `N` | Acessibilidade para pessoa com deficiência |
| `ativo` | `S` ou `N` | Situação do veículo |
| `descricao_inativo` | texto | Justificativa da inativação |
| `motorista` | inteiro | Condutor padrão |
| `motoristaNome` | texto | Nome exibido no campo de seleção |
| `empresa` | inteiro | Empresa de vínculo |
| `empresaNome` | texto | Razão social exibida no campo de seleção |
| `observacao` | texto | Observação livre |

### 3.4 Ponto de parada 🟢 `Ponto.js:32-46`

| Campo | Formato legado | Observação |
|-------|-----------------|------------|
| `id` | inteiro | Identificador do ponto |
| `desc` | texto | Descrição do ponto |
| `cep` | texto | Código postal, gatilho do preenchimento automático |
| `logradouro` | texto | Logradouro preenchido pelo serviço de CEP |
| `numero` | texto | Número preenchido pelo serviço de CEP |
| `complemento` | texto | Complemento preenchido pelo serviço de CEP |
| `bairro` | texto | Bairro preenchido pelo serviço de CEP |
| `idmun` | inteiro | Município preenchido pelo serviço de CEP |
| `municipio` | texto | Nome do município exibido no campo de seleção |
| `sigla_uf` | texto | Sigla da unidade federativa |
| `latitude` | texto | Coordenada preenchida pelo serviço, campo somente leitura 🟢 `Ponto.js:61-64` |
| `longitude` | texto | Coordenada preenchida pelo serviço, campo somente leitura 🟢 `Ponto.js:61-64` |

### 3.5 Rota 🟢 `Rota.js:43-57`

| Campo | Formato legado | Observação |
|-------|-----------------|------------|
| `id` | inteiro | Identificador da rota |
| `desc` | texto | Descrição da rota |
| `ref_idpes_destino` | inteiro | Escola de destino |
| `nomeDestino` | texto | Nome exibido no campo de seleção |
| `ref_cod_empresa_transporte_escolar` | inteiro | Empresa de transporte |
| `nomeEmpresa` | texto | Razão social exibida no campo de seleção |
| `ano` | inteiro | Ano de vigência da rota |
| `tipo_rota` | texto | Tipo da rota |
| `km_pav` | numérico | Extensão pavimentada |
| `km_npav` | numérico | Extensão não pavimentada |
| `tercerizado` | `S` ou `N` | Rota operada por terceiro |

### 3.6 Pessoa de transporte 🟢 `Pessoatransporte.js:87-110` e `AlunoController.php:1789-1797`

| Campo | Formato legado | Observação |
|-------|-----------------|------------|
| `id` | inteiro | `cod_pessoa_transporte` |
| `pessoa` | inteiro | Pessoa atendida |
| `pessoa_nome` | texto | Nome exibido no campo de seleção |
| `pessoaj` | inteiro | Pessoa jurídica de destino |
| `pessoaj_nome` | texto | Nome exibido no campo de seleção |
| `rota` | inteiro | Rota de transporte escolar |
| `ponto` | inteiro | Ponto de embarque, carregado conforme a rota 🟢 `Pessoatransporte.js:1-24` |
| `turno` | texto | Turno de atendimento |
| `observacao` | texto | Observação livre |

---

## 4. Contrato de escrita da API de aluno 🟢 `ieducar/modules/Api/Views/AlunoController.php`

| Campo da requisição | Destino no legado | Validação observada |
|----------------------|-------------------|----------------------|
| `tipo_transporte` | `aluno.tipo_transporte` | Domínio `nenhum`, `municipal`, `estadual` 🟢 `:102-109` |
| `rota_transporte` | `aluno.rota_transporte` | Sem validação observada 🟢 `:678` |
| `utiliza_transporte_rural` | `aluno.utiliza_transporte_rural` | Conversão para booleano 🟢 `:679` |
| `veiculo_transporte_escolar` | `aluno.veiculo_transporte_escolar` | Array serializado por vírgula, com remoção de vazios 🟢 `:651-657` |
| `transporte_rota` | `pessoa_transporte.ref_cod_rota_transporte_escolar` | Sem validação observada 🟢 `:1796` |
| `transporte_ponto` | `pessoa_transporte.ref_cod_ponto_transporte_escolar` | Sem validação observada 🟢 `:1795` |
| `transporte_observacao` | `pessoa_transporte.observacao` | Sem validação observada 🟢 `:1797` |
| `pessoaj_id` | `pessoa_transporte.ref_idpes_destino` | Sem validação observada 🟢 `:1794` |

---

## 5. Contrato de saída da API de aluno 🟢 `ieducar/modules/Api/Views/AlunoController.php:1192-1223`

| Campo de saída | Formato | Conversão |
|----------------|---------|-----------|
| `veiculo_transporte_escolar` | array | Conversão do array PostgreSQL para array PHP 🟢 `:1223` |
| `tipo_transporte` | texto | Tradução pelo `TransportationProvider::getValueDescription` 🟢 `:1217` e `app/Models/TransportationProvider.php:42-48` |
| `rota_transporte` | inteiro | Sem conversão 🟢 `:1208` |
| `utiliza_transporte_rural` | inteiro | `true` para 1 e `false` para 0 🟢 `:1221` |

---

## 6. Contrato de exportação do Censo Escolar 🟢 `database/sqls/views/public.educacenso_record60.sql:25-49`

| Campo do Registro 60 | Origem | Valor esperado |
|-----------------------|--------|----------------|
| `transportePublico` | `CASE WHEN aluno.tipo_transporte > 0 THEN 1 ELSE aluno.tipo_transporte END` | 1 quando há transporte, caso contrário o próprio tipo 🟢 `:25-26` |
| `poderPublicoResponsavelTransporte` | `aluno.tipo_transporte` | 1 estadual, 2 municipal, 3 compartilhado 🟢 `:27` |
| `veiculoTransporteVanKonbi` | `ARRAY[1] <@ aluno.veiculo_transporte_escolar` | 1 quando o tipo 1 está presente 🟢 `:32` |
| `veiculoTransporteMicroonibus` | `ARRAY[2] <@ ...` | 1 quando o tipo 2 está presente 🟢 `:29` |
| `veiculoTransporteOnibus` | `ARRAY[3] <@ ...` | 1 quando o tipo 3 está presente 🟢 `:30` |
| `veiculoTransporteBicicleta` | `ARRAY[4] <@ ...` | 1 quando o tipo 4 está presente 🟢 `:28` |
| `veiculoTransporteTracaoAnimal` | `ARRAY[5] <@ ...` | 1 quando o tipo 5 está presente 🟢 `:31` |
| `veiculoTransporteOutro` | `ARRAY[6] <@ ...` | 1 quando o tipo 6 está presente 🟢 `:33` |
| `veiculoTransporteAquaviarioCapacidade5` | `ARRAY[7] <@ ...` | 1 quando o tipo 7 está presente 🟢 `:34` |
| `veiculoTransporteAquaviarioCapacidade5a15` | `ARRAY[8] <@ ...` | 1 quando o tipo 8 está presente 🟢 `:35` |
| `veiculoTransporteAquaviarioCapacidade15a35` | `ARRAY[9] <@ ...` | 1 quando o tipo 9 está presente 🟢 `:36` |
| `veiculoTransporteAquaviarioCapacidadeAcima35` | `ARRAY[10] <@ ...` | 1 quando o tipo 10 está presente 🟢 `:37` |
| `veiculoTransporteEscolar` | `aluno.veiculo_transporte_escolar` | Lista original de códigos 🟢 `:49` |

Cobertura ausente na visão legada: o código 11, modal ferroviário, não tem flag correspondente. 🔴

---

## 7. Contrato de domínio do tipo de transporte 🟢 `app/Models/TransportationProvider.php:9-25`

| Valor persistido | Rótulo | Aceito na API |
|------------------|--------|---------------|
| 0 | Não utiliza | `nenhum` |
| 1 | Estadual | `estadual` |
| 2 | Municipal | `municipal` |
| 3 | — | Não existe no enum legado 🔴 |

---

## 8. Contrato planejado para o modelo novo

Endpoints previstos em `_reversa_sdd/Transport/legacy-mapping.md`, seção 4, a derivar do contrato legado acima:

| Método | Caminho | Deriva de |
|--------|---------|-----------|
| GET | `/api/v1/educa/transport/vehicles` | listagem de veículo por busca 🟢 `Veiculo.js:37` |
| POST | `/api/v1/educa/transport/vehicles` | gravação de veículo 🟢 `Veiculo.js:17-25` |
| POST | `/api/v1/educa/transport/vehicles/{id}/inspections` | registro de vistoria, ausente no legado 🔴 |
| GET | `/api/v1/educa/transport/drivers` | listagem de motorista 🟢 `Motorista.js:37` |
| GET | `/api/v1/educa/transport/routes` | listagem de rota 🟢 `Rota.js:34` |
| GET | `/api/v1/educa/transport/routes/{id}/occupancy` | verificação de lotação, ausente no legado 🔴 |
| GET | `/api/v1/educa/transport/stops` | consulta de pontos por rota 🟢 `Pessoatransporte.js:24` |
| POST | `/api/v1/educa/transport/routes/{routeId}/students` | gravação de pessoa de transporte 🟢 `AlunoController.php:1779-1800` |
| GET | `/api/v1/educa/transport/census/record60-validation` | consistência da exportação do Registro 60, ausente no legado 🔴 |
