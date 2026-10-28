# API — Cadastro base

Base: `http://localhost:8080/api/v1` e `$TOKEN` conforme `identity.md`.

## Escolas — `registry.school.read` / `registry.school.manage`

```bash
curl -s "$API/registry/schools?page=1&per_page=20&search=Municipal" \
  -H "Authorization: Bearer $TOKEN"

curl -s -X POST "$API/registry/schools" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Escola Municipal São José",
    "inep_code": "31012345",
    "education_network": "municipal",
    "city": "Belo Horizonte",
    "state_uf": "MG",
    "address": "Rua das Acácias, 100",
    "is_active": true
  }'

curl -s -X PUT "$API/registry/schools/<id>" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Escola Municipal São José","inep_code":"31012345","education_network":"municipal","city":"Belo Horizonte","state_uf":"MG","address":"Rua das Acácias, 100","is_active":true}'

curl -s "$API/registry/schools/<id>" -H "Authorization: Bearer $TOKEN"
curl -s -X DELETE "$API/registry/schools/<id>" -H "Authorization: Bearer $TOKEN"
```

`inep_code` é único entre escolas ativas (`409` em duplicidade). `DELETE` é lógico.

## Alunos — `registry.student.read` / `registry.student.manage`

```bash
curl -s -X POST "$API/registry/students" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "full_name": "Ana Clara Souza",
    "birth_date": "2014-05-20",
    "document": "12345678900",
    "notes": null,
    "guardians": [
      {"full_name":"Joana Souza","document":"98765432100","phone":"31999990000","email":null,"relationship":"Mãe","is_primary":true}
    ]
  }'
```

- Pelo menos um responsável com nome é obrigatório (`422`).
- `GET /registry/students/{id}` retorna `{ "student": {…}, "guardians": [ … ] }`.

## Responsáveis

```bash
curl -s "$API/registry/guardians?page=1&per_page=20" -H "Authorization: Bearer $TOKEN"
```

## Anos letivos

```bash
curl -s "$API/registry/academic-years" -H "Authorization: Bearer $TOKEN"

curl -s -X POST "$API/registry/academic-years" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"year":2026,"starts_on":"2026-02-02","ends_on":"2026-12-18","is_active":true}'
```

## Matrículas — `registry.enrollment.read` / `registry.enrollment.manage`

```bash
curl -s "$API/registry/enrollments?page=1&per_page=20&academic_year_id=<ano>&school_id=<escola>&search=Ana" \
  -H "Authorization: Bearer $TOKEN"

curl -s -X POST "$API/registry/enrollments" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "student_id": "<aluno>",
    "school_id": "<escola>",
    "academic_year_id": "<ano>",
    "grade": "5º ano",
    "shift": "morning",
    "has_curricular_attendance": true,
    "didactic_mediation": "presencial",
    "country": "BR",
    "start_date": "2026-02-02"
  }'
```

Unicidade: no máximo uma matrícula ativa por aluno/escola/ano (`409`).

Os campos `has_curricular_attendance`, `didactic_mediation`
(`presencial`, `semipresencial`, `distancia`) e `country` alimentam a regra de
anulação da declaração de transporte público no Registro 60. Quando omitidos,
assumem `true`, `presencial` e `BR`.

### Encerramento

```bash
curl -s -X POST "$API/registry/enrollments/<id>/close" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"end_date":"2026-07-01","reason":"Transferência"}'
```

O encerramento finaliza automaticamente as alocações de transporte ativas,
liberando as vagas nas rotas.
