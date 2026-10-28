# Operação

## Arquitetura de execução

| Serviço | Imagem/build        | Porta             | Observações                              |
| ------- | ------------------- | ----------------- | ---------------------------------------- |
| `db`    | `mysql:8.4`         | interna 3306      | volume nomeado `db_data`                 |
| `api`   | `backend/Dockerfile`| interna 8080      | migrations no start, health `/health`    |
| `web`   | `frontend/Dockerfile` | `${WEB_PORT}` (8080) | nginx com proxy `/api` para a API    |

A API aplica as migrations pendentes e o seed idempotente antes de abrir a porta.

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
| -------- | ----------- | --------- |
| `MYSQL_DATABASE` | não (`transport`) | nome do banco |
| `MYSQL_USER` | não (`transport`) | usuário da aplicação |
| `MYSQL_PASSWORD` | sim | senha do usuário da aplicação |
| `MYSQL_ROOT_PASSWORD` | sim | senha do root do MySQL |
| `JWT_SECRET` | sim | segredo HMAC dos tokens (32+ bytes aleatórios) |
| `ACCESS_TOKEN_MINUTES` | não (`15`) | validade do access token |
| `REFRESH_TOKEN_DAYS` | não (`7`) | validade do refresh token |
| `CORS_ORIGINS` | não | origens permitidas, separadas por vírgula |
| `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | sim para o primeiro start | administrador inicial |
| `SEED_DEMO` | não (`false`) | cria dados de demonstração |
| `RUN_MIGRATIONS` | não (`true`) | executa migrations no start |
| `WEB_PORT` | não (`8080`) | porta publicada do console |
| `VITE_MAP_TILE_URL` / `VITE_MAP_ATTRIBUTION` | não | tiles do mapa no build do frontend |

O Compose exige `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`, `JWT_SECRET` e
`ADMIN_PASSWORD`; sem elas o `docker compose up` falha com mensagem explícita.

## Primeira execução

```bash
cp .env.example .env
# edite .env com segredos reais
docker compose up -d --build
docker compose ps
curl -fsS http://localhost:8080/health
```

O console fica em `http://localhost:8080`. Autentique com `ADMIN_EMAIL` e
`ADMIN_PASSWORD` definidos no `.env` e troque a senha em **Usuários → Senha**.

Para dados de demonstração, defina `SEED_DEMO=true` antes do primeiro start.

## Backup e restauração

Backup lógico (recomendado para rotina):

```bash
docker compose exec -T db \
  mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers transport \
  > backup-$(date +%F).sql
```

Restauração em banco limpo:

```bash
docker compose down
docker compose up -d db
docker compose exec -T db \
  sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "DROP DATABASE IF EXISTS transport; CREATE DATABASE transport CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"'
docker compose exec -T db \
  sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" transport' < backup-2026-10-20.sql
docker compose up -d api web
```

Backup físico do volume (parar a API antes para evitar escrita concorrente):

```bash
docker compose stop api
docker run --rm -v transporte-escolar_db_data:/data -v "$PWD":/backup alpine \
  tar czf /backup/db_data-$(date +%F).tar.gz -C /data .
docker compose start api
```

Guarde os backups fora do host e teste a restauração periodicamente.

## Atualização de schema

1. Crie `db/migrations/000N_descricao.sql` — nunca edite uma migration já aplicada.
2. Cada arquivo pode conter vários statements; o runner divide por `;` e registra
   a versão em `schema_migrations`.
3. Suba a nova versão: `docker compose up -d --build api`.
4. Confira os logs: `docker compose logs -f api` (mensagem `migrations aplicadas`).

Triggers e rotinas exigem `log_bin_trust_function_creators=1` no MySQL com binlog
ativo; o Compose já configura a flag. Em MySQL gerenciado, habilite o parâmetro no
painel do provedor.

## Auditoria

`audit_events` é append-only: triggers bloqueiam `UPDATE` e `DELETE`
(`SQLSTATE 45000`), inclusive para o usuário da aplicação. Não há expurgo
automático. Defina a retenção conforme a legislação aplicável e, se necessário,
exporte o período antes de qualquer manutenção excepcional feita por um DBA com
privilégios elevados.

Consultas de apoio:

```bash
docker compose exec db mysql -utransport -p"$MYSQL_PASSWORD" transport \
  -e "SELECT resource, COUNT(*) FROM audit_events GROUP BY resource ORDER BY 2 DESC;"
```

## Logs e diagnóstico

```bash
docker compose logs -f api     # tracing JSON com request_id
docker compose logs -f web     # nginx
docker compose logs -f db      # MySQL
```

- `/health` retorna `{"status":"ok","database":"up"}`; `503` indica banco indisponível.
- `423` no login: conta bloqueada por 5 falhas em 15 minutos.
- `409` em rotas: veículo/motorista irregular, contrato vencido ou capacidade cheia.
- `CORS`: ajuste `CORS_ORIGINS` se o console for servido em outro domínio.
- Rotação de `JWT_SECRET` invalida todos os tokens emitidos.

### Reset completo do ambiente de desenvolvimento

```bash
docker compose down -v
docker compose up -d --build
```

Isso remove o volume e recria o schema, o administrador e o seed demo (se habilitado).

## Verificações

```bash
./scripts/check.ps1        # Windows
./scripts/check.sh         # Linux/macOS
```

O script executa `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test`,
`npm run build`, `npm test` e valida se os tipos gerados do OpenAPI estão em dia.

Testes E2E (com a API e o console no ar):

```bash
cd frontend
npx playwright install chromium
E2E_BASE_URL=http://localhost:8080 npm run e2e
```

## Notas do ambiente de build

O repositório inclui `.cargo/config.toml` apontando para um mirror de crates
(rsproxy) usado quando `index.crates.io` está indisponível. Em redes com acesso
direto ao crates.io, remova esse arquivo para usar a fonte oficial.
