# API — Identidade, acesso e auditoria

Base: `http://localhost:8080/api/v1`

Todas as rotas, exceto login/refresh, exigem `Authorization: Bearer <access_token>`.
Erros seguem RFC 7807 (`application/problem+json`) com `errors[]` para validação por campo.

```bash
export API=http://localhost:8080/api/v1
export TOKEN=$(curl -s -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@escola.local","password":"Admin1234"}' | jq -r .access_token)
```

## Autenticação

### `POST /auth/login`

```bash
curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"admin@escola.local","password":"Admin1234"}'
```

Resposta `200`:

```json
{
  "access_token": "…",
  "refresh_token": "…",
  "token_type": "Bearer",
  "expires_in": 900,
  "user": { "id": "…", "full_name": "Administrador", "email": "admin@escola.local", "roles": ["admin"], "permissions": ["…"] }
}
```

- `401`: credenciais inválidas.
- `423`: conta bloqueada por 5 falhas em 15 minutos; use o desbloqueio administrativo.

### `POST /auth/refresh`

Rotação de refresh token: o token usado é revogado e um novo par é emitido.

```bash
curl -s -X POST "$API/auth/refresh" -H 'Content-Type: application/json' \
  -d '{"refresh_token":"<refresh>"}'
```

### `POST /auth/logout`

```bash
curl -s -X POST "$API/auth/logout" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"refresh_token":"<refresh>"}'
```

### `GET /auth/me`

```bash
curl -s "$API/auth/me" -H "Authorization: Bearer $TOKEN"
```

## Usuários — permissão `identity.user.manage`

### `GET /identity/users?page=1&per_page=20&search=`

```bash
curl -s "$API/identity/users?page=1&per_page=20" -H "Authorization: Bearer $TOKEN"
```

### `POST /identity/users`

```bash
curl -s -X POST "$API/identity/users" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "full_name": "Maria Operadora",
    "email": "maria@escola.local",
    "password": "Senha1234",
    "role_ids": ["<role_id>"]
  }'
```

Senha mínima: 8 caracteres, com letra e número (`422` caso contrário).

### `PUT /identity/users/{id}`

```bash
curl -s -X PUT "$API/identity/users/<id>" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"full_name":"Maria Operadora","email":"maria@escola.local","is_active":true,"role_ids":["<role_id>"]}'
```

A autodesativação é bloqueada com `409`.

### `POST /identity/users/{id}/unlock`

```bash
curl -s -X POST "$API/identity/users/<id>/unlock" -H "Authorization: Bearer $TOKEN"
```

### `POST /identity/users/{id}/password`

```bash
curl -s -X POST "$API/identity/users/<id>/password" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"password":"NovaSenha123"}'
```

Redefinir a senha incrementa `token_version` e encerra todas as sessões do usuário.

## Papéis e permissões — permissão `identity.role.manage`

```bash
curl -s "$API/identity/roles" -H "Authorization: Bearer $TOKEN"
curl -s "$API/identity/permissions" -H "Authorization: Bearer $TOKEN"

curl -s -X POST "$API/identity/roles" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "code": "gestor_escolar",
    "name": "Gestor escolar",
    "description": "Leitura de cadastros e rotas",
    "permission_codes": ["registry.school.read", "transport.route.read"]
  }'

curl -s -X PUT "$API/identity/roles/<id>" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"code":"gestor_escolar","name":"Gestor escolar","description":null,"permission_codes":["registry.school.read"]}'
```

Permissões seguem o padrão `<recurso>.<ação>`; a ausência de permissão resulta em `403`.

## Auditoria — permissão `identity.audit.read`

```bash
curl -s "$API/identity/audit?page=1&per_page=25&from=2026-01-01&to=2026-12-31&resource=transport.route" \
  -H "Authorization: Bearer $TOKEN"
```

A tabela `audit_events` é append-only: triggers rejeitam `UPDATE` e `DELETE`
(`SQLSTATE 45000`), inclusive para o usuário da aplicação. O campo `request_id`
correlaciona a trilha com os logs JSON da API.
