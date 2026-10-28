# API — Frota

Base: `http://localhost:8080/api/v1` e `$TOKEN` conforme `identity.md`.

## Empresas — `transport.company.read` / `transport.company.manage`

```bash
curl -s "$API/transport/companies?page=1&per_page=20" -H "Authorization: Bearer $TOKEN"

curl -s -X POST "$API/transport/companies" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "legal_name": "Transporte Escolar Boa Viagem Ltda",
    "cnpj": "11222333000181",
    "contract_number": "CT-2026/01",
    "contract_start_date": "2026-01-02",
    "contract_end_date": "2026-12-31",
    "responsible_name": "Carlos Pereira",
    "phone": "3133334444",
    "email": "contato@boaviagem.example",
    "is_active": true,
    "notes": null
  }'
```

A listagem expõe `contract_expired`. Rotas vinculadas a empresa com contrato vencido
são rejeitadas com `409`.

## Motoristas — `transport.driver.read` / `transport.driver.manage`

```bash
curl -s "$API/transport/drivers?page=1&per_page=20&search=José" \
  -H "Authorization: Bearer $TOKEN"

curl -s -X POST "$API/transport/drivers" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "company_id": "<empresa>",
    "full_name": "José da Silva",
    "cpf": "12345678900",
    "birth_date": "1980-04-12",
    "cnh_number": "01234567890",
    "cnh_category": "D",
    "cnh_first_issue_date": "2004-03-18",
    "cnh_expiration_date": "2027-04-12",
    "course_certificate": "CURSO-2025-01",
    "course_expiration_date": "2027-01-10",
    "toxicological_exam_date": "2025-08-01",
    "toxicological_expiration_date": "2027-08-01",
    "phone": "31988887777",
    "is_active": true,
    "notes": null
  }'
```

Regras de elegibilidade (CTB arts. 136–139):

- categoria de CNH `D` ou `E`;
- idade mínima de 21 anos;
- data da primeira habilitação (`cnh_first_issue_date`), quando informada, não pode
  ser posterior ao vencimento da CNH nem anterior à data de nascimento;
- CNH, curso especializado e toxicológico válidos na data;
- motorista ativo sem documentação válida é rejeitado com `422`;
- vínculo a rota com documentação irregular retorna `409`.

A listagem inclui `issues[]` com os impedimentos encontrados.

### Alertas de vencimento

```bash
curl -s "$API/transport/drivers/alerts" -H "Authorization: Bearer $TOKEN"
curl -s "$API/transport/alerts" -H "Authorization: Bearer $TOKEN"
```

Documentos com vencimento em até 30 dias retornam `severity=warning`; vencidos,
`severity=critical`.

## Veículos — `transport.vehicle.read` / `transport.vehicle.manage`

```bash
curl -s "$API/transport/vehicles?page=1&per_page=20&search=ABC" \
  -H "Authorization: Bearer $TOKEN"

curl -s -X POST "$API/transport/vehicles" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "company_id": "<empresa>",
    "default_driver_id": "<motorista>",
    "description": "Ônibus escolar 01",
    "plate": "ABC1D23",
    "renavam": "01234567890",
    "data_licenca": "2026-01-10",
    "chassis": "9BWZZZ377VT004251",
    "brand_model": "Volkswagen 15.190",
    "manufacture_year": 2020,
    "model_year": 2021,
    "passenger_capacity": 44,
    "network_type": "rural",
    "vehicle_type_inep": 2,
    "is_exclusive_school_use": true,
    "is_accessible_disability": false,
    "last_inspection_date": "2026-01-15",
    "inspection_certificate_number": "VIST-2026-001",
    "inspection_valid_until": "2026-07-15",
    "is_active": true,
    "deactivation_reason": null,
    "notes": null
  }'
```

- placa normalizada para maiúsculas e sem separadores, única (`409`);
- `passenger_capacity > 0`;
- `vehicle_type_inep` entre 1 e 11;
- `network_type` em `rural`, `urban` ou `mixed`;
- `default_driver_id`, quando informado, precisa existir e estar ativo (`422`).

### Vistorias — `transport.inspection.read` / `transport.inspection.manage`

```bash
curl -s "$API/transport/vehicles/<id>/inspections" -H "Authorization: Bearer $TOKEN"

curl -s -X POST "$API/transport/vehicles/<id>/inspections" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{
    "inspection_date": "2026-07-20",
    "certificate_number": "VIST-2026-002",
    "valid_until": "2027-01-20",
    "notes": "Aprovado sem restrições"
  }'
```

A vistoria mais recente passa a ser a vigente do veículo. Veículo com vistoria
vencida não pode ser vinculado a rotas (`409`).
