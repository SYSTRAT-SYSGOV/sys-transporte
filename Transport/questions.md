# Transporte Escolar (i-Educar legado), Perguntas em Aberto

> Lacunas 🔴 que dependem de validação humana antes da reimplementação da unit de transporte escolar.

---

| # | Pergunta | Origem | Impacto | Dono | Prazo |
|---|-----------|--------|---------|------|-------|
| Q-01 | A implementação servidora do módulo de transporte (classes `clsModules*` e páginas `transporte_*` do intranet) existe em outro repositório? Onde ficam as regras de validação, unicidade e os tipos reais das colunas das tabelas `modules.*`? | Ausência das classes e páginas no repositório atual | Alto | Arquitetura | Antes da migração |
| Q-02 | Quais regras de validação, de unicidade e de cascade o legado aplicava nos cadastros de empresa, motorista, veículo, ponto, rota e pessoa de transporte? | Só há evidência da camada de apresentação | Alto | Produto | Antes da migração |
| Q-03 | O valor 3 de poder público responsável, compartilhado, exigido pelo Registro 60, deve passar a ser selecionável pelo gestor? Como tratar os alunos que hoje são gravados como 0 por falta do valor no enum? | `app/Models/TransportationProvider.php:9-14` | Alto | Produto e Jurídico | Antes da exportação |
| Q-04 | O código 11 de tipologia modal ferroviário, previsto no Registro 60, tem obrigação de exportação no contexto do município? A ausência da flag na visão atual é omissão ou decisão? | `database/sqls/views/public.educacenso_record60.sql:28-37` | Alto | Jurídico | Antes da exportação |
| Q-05 | A regra de lotação é nova. Ela deve bloquear a alocação desde o primeiro dia ou entrar em modo informativo com notificação ao gestor? | Ausente no legado | Alto | Produto | Antes da implementação |
| Q-06 | O que significam exatamente os campos `malha` e `tipo` do veículo, e qual conjunto de valores deve ser aceito na migração? | `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Veiculo.js:55-56` | Médio | Operação | Antes da migração |
| Q-07 | A ordem de atendimento das paradas dentro da rota é mantida hoje em controle fora do sistema? Em caso positivo, é possível importar essa ordem? | Ausência de campo de ordem no legado | Alto | Operação | Antes da migração |
| Q-08 | Qual serviço preenche o endereço e as coordenadas do ponto a partir do CEP, e qual deve ser o comportamento quando o serviço está indisponível? | `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Ponto.js:40-46` | Médio | Operação | Antes da implementação |
| Q-09 | As coordenadas legadas são texto em graus decimais com vírgula ou em grau minuto decimal? A conversão para numérico exige tratamento específico? | `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Ponto.js:37-38` | Médio | Dados | Antes da migração |
| Q-10 | A empresa de transporte deve ter vigência de contrato e responsável legal obrigatórios desde a primeira versão do modelo novo, mesmo para a frota municipal própria? | Campo inexistente no legado | Alto | Produto e Jurídico | Antes da implementação |
| Q-11 | Qual prazo de validade do curso do CONTRAN e do exame toxicológico se aplica ao condutor de transporte escolar, e qual periodicidade vale para a vistoria do DETRAN por modal? | CTB, arts. 136 a 139 | Alto | Jurídico | Antes da implementação |
| Q-12 | O valor `rota_transporte` gravado no aluno é mantido em uso depois da adoção da tabela de alocação, ou deve ser desativado em favor do vínculo por matrícula? | `ieducar/modules/Api/Views/AlunoController.php:678` | Médio | Arquitetura | Antes da migração |
| Q-13 | A rota pode atender mais de uma escola de destino, ou o modelo de uma escola por rota é regra do negócio? | `public/vendor/legacy/TransporteEscolar/Assets/Javascripts/Rota.js:45-46` | Alto | Produto | Antes da implementação |
| Q-14 | O tempo médio de deslocamento, usado na meta de redução de 15%, deve ser apurado por horário estimado de passagem ou por dados de execução real? | `_reversa_sdd/prd.md` | Alto | Produto | Antes da implementação |
| Q-15 | Há estudantes com pessoa de transporte registrada e matrícula encerrada? A carga deve marcar esses casos como divergência ou descartá-los? | `ieducar/modules/Api/Views/AlunoController.php:1786-1789` | Médio | Dados | Antes da migração |
| Q-16 | A exclusão do método legado `createOrUpdatePessoaTransporte`, marcada com TODO, está prevista para esta modernização ou para outro ciclo? | `ieducar/modules/Api/Views/AlunoController.php:1781` | Médio | Arquitetura | Antes da implementação |
