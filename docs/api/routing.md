# API — Rotas e itinerários

Base: `http://localhost:8080/api/v1` e `$TOKEN` conforme `identity.md`.

## Pontos de parada — `transport.stop.read` / `transport.stop.manage`

```bash
curl -s "$API/transport/stops?page=1&per_page=20&search=Praça" \
  -H "Authorization: Bearer $TOKEN"

# Somente as paradas do itinerário da rota, na ordem de sequência
curl -s "$API/transport/stops?route_id=<rota>&per_page=100" \
  -H "Authorization: Bearer $TOKEN"

curl -s -X POST "$API/transport/stops" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Praça Central",
    "description": "Em frente à igreja",
    "latitude": -19.9245,
    "longitude": -43.9352,
    "postal_code": "30110-000",
    "street": "Praça da Matriz",
    "number": "10",
    "complement": null,
    "neighborhood": "Centro",
    "city": "Belo Horizonte",
    "state_uf": "MG",
    "landmark": "Igreja Matriz",
    "is_active": true
  }'
```

Latitude deve estar entre -90 e 90 e longitude entre -180 e 180 (`422`).

## Rotas — `transport.route.read` / `transport.route.manage`

```bash
curl -s "$API/transport/routes?page=1&per_page=20&academic_year_id=<ano>&school_id=<escola>&shift=morning&route_type=rural&is_active=true" \
  -H "Authorization: Bearer $TOKEN"

curl -s -X POST "$API/transport/routes" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Rota Central",
    "school_id": "<escola>",
    "academic_year_id": "<ano>",
    "company_id": "<empresa>",
    "vehicle_id": "<veículo>",
    "driver_id": "<motorista>",
    "shift": "morning",
    "route_type": "rural",
    "km_paved": 12.5,
    "km_unpaved": 7.25,
    "departure_time": "06:30:00",
    "arrival_time": "07:20:00",
    "return_departure_time": "12:10:00",
    "is_outsourced": false,
    "is_active": true,
    "notes": null
  }'
```

- `total_km` é coluna gerada (`km_paved + km_unpaved`): 12,50 + 7,25 = 19,75 km.
- Veículo sem vistoria válida, motorista inelegível ou empresa com contrato vencido
  resultam em `409`.
- Turnos: `morning`, `afternoon`, `night`, `full_day`.
- Tipos: `rural`, `urban`, `mixed`.

### Detalhe

```bash
curl -s "$API/transport/routes/<id>" -H "Authorization: Bearer $TOKEN"
```

Retorna os campos da rota, `occupancy_percentage`, `itinerary_valid` e `stops[]`.

## Itinerário

```bash
curl -s -X PUT "$API/transport/routes/<id>/stops" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{
    "stops": [
      {"stop_id":"<parada-1>","estimated_pickup_time":"06:30:00","estimated_dropoff_time":"07:05:00"},
      {"stop_id":"<parada-2>","estimated_pickup_time":"06:45:00","estimated_dropoff_time":"07:10:00"}
    ]
  }'
```

- A ordem do array define `sequence_order` (1..n).
- Parada repetida retorna `409`.
- O itinerário é considerado válido com ao menos duas paradas e horários de
  embarque/desembarque preenchidos.

## Ocupação

```bash
curl -s "$API/transport/routes/<id>/occupancy" -H "Authorization: Bearer $TOKEN"
```

Resposta:

```json
{
  "route_id": "…",
  "name": "Rota Central",
  "capacity": 40,
  "allocated_students": 20,
  "occupancy_percentage": 50.0,
  "status": "ok"
}
```

Faixas: `ok` até 80%, `warning` acima de 80%, `critical` acima de 100%,
`unknown` quando não há veículo vinculado.
