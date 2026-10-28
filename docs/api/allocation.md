# API — Alocação de estudantes e Censo

Base: `http://localhost:8080/api/v1` e `$TOKEN` conforme `identity.md`.

## Listar alocações da rota — `transport.allocation.read`

```bash
curl -s "$API/transport/routes/<rota>/students" -H "Authorization: Bearer $TOKEN"
curl -s "$API/transport/routes/<rota>/students?include_closed=true" \
  -H "Authorization: Bearer $TOKEN"
```

## Alocar estudante — `transport.allocation.manage`

```bash
curl -s -X POST "$API/transport/routes/<rota>/students" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{
    "student_id": "<aluno>",
    "stop_id": "<parada-do-itinerario>",
    "shift": "morning",
    "uses_rural_transport": true,
    "public_transport_jurisdiction": 2,
    "special_needs_transport": false,
    "special_needs_notes": null,
    "start_date": "2026-02-10",
    "override_justification": null
  }'
```

Validações:

- matrícula ativa do aluno no ano letivo da rota (`422`);
- parada precisa pertencer ao itinerário da rota (`422`);
- `shift`, quando enviado, precisa ser igual ao turno da rota (`422`);
- `public_transport_jurisdiction`: 1 = estadual, 2 = municipal, 3 = compartilhado;
- estudante com `special_needs_transport = true` exige veículo adaptado (`409`);
- duplicidade de alocação ativa para o mesmo aluno na rota (`409`);
- a cada alocação, contrato da empresa, vistoria do veículo e documentação do
  motorista são revalidados; qualquer irregularidade retorna `409`.

### Capacidade e exceção

A contagem é feita dentro de transação com `SELECT … FOR UPDATE` na rota, evitando
duas alocações simultâneas ultrapassarem o limite.

Ao atingir a capacidade:

- sem `transport.allocation.override_capacity` ou sem justificativa → `409`;
- com a permissão e `override_justification` preenchida → alocação criada e evento
  `create_with_capacity_override` registrado na auditoria com a justificativa.

```bash
curl -s -X POST "$API/transport/routes/<rota>/students" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{
    "student_id": "<aluno>",
    "stop_id": "<parada>",
    "uses_rural_transport": true,
    "public_transport_jurisdiction": 2,
    "special_needs_transport": false,
    "special_needs_notes": null,
    "start_date": null,
    "override_justification": "Único transporte disponível durante reforma da van"
  }'
```

## Encerrar alocação

```bash
curl -s -X DELETE "$API/transport/routes/<rota>/students/<alocacao>" \
  -H "Authorization: Bearer $TOKEN"
```

A alocação recebe `end_date` e `end_reason`, permanece no histórico e libera a vaga.
Encerrar a matrícula também encerra as alocações vinculadas.

## Censo — `transport.census.read` / `transport.census.export`

### Pré-validação

```bash
curl -s "$API/transport/census/validation?academic_year_id=<ano>" \
  -H "Authorization: Bearer $TOKEN"
```

Resposta:

```json
{
  "academic_year_id": "…",
  "year": 2026,
  "total_students": 120,
  "approved": false,
  "pendencies": [
    {
      "enrollment_id": "…",
      "student_id": "…",
      "student_name": "Ana Clara Souza",
      "school_name": "Escola Municipal São José",
      "kind": "sem_alocacao_ativa",
      "detail": "Estudante sem alocação de transporte ativa"
    }
  ]
}
```

Tipos de pendência:

| `kind`                   | Regra                                                       |
| ------------------------ | ----------------------------------------------------------- |
| `sem_alocacao_ativa`     | matrícula ativa sem alocação vigente                        |
| `rota_sem_veiculo`       | alocação em rota sem veículo vinculado                      |
| `rural_sem_declaracao`   | estudante rural sem `uses_rural_transport`                  |
| `veiculo_nao_adaptado`   | necessidade especial sem veículo acessível                  |

`approved` só é `true` quando não há pendências.

### Exportação CSV

```bash
curl -s "$API/transport/census/export?academic_year_id=<ano>" \
  -H "Authorization: Bearer $TOKEN" -o censo.csv
```

Cabeçalho estável:

```
student_id,student_name,school,academic_year,shift,uses_rural_transport,public_transport_jurisdiction,route,vehicle_plate,vehicle_type_inep,transporte_publico,poder_publico_responsavel_transporte,veiculo_van_konbi,veiculo_microonibus,veiculo_onibus,veiculo_bicicleta,veiculo_tracao_animal,veiculo_outro,veiculo_aquaviario_ate_5,veiculo_aquaviario_5_15,veiculo_aquaviario_15_35,veiculo_aquaviario_acima_35,veiculo_ferroviario
```

As colunas a partir de `transporte_publico` seguem as variáveis do Registro 60:
`transporte_publico` é `1` quando há declaração e `0` caso contrário; o poder
público repete a jurisdição (1/2/3); cada `veiculo_*` marca `1` para a tipologia
INEP do veículo da rota. A declaração é anulada (campos de transporte público
vazios) quando a matrícula não tem atendimento curricular, quando a mediação é
`distancia` ou quando o país de residência não é `BR`.

Uma linha por aluno com alocação ativa no ano. `Content-Disposition` define
`censo-transporte-<ano>.csv`.
