#!/usr/bin/env bash
# Executa formatação, lint, testes e build do projeto.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

echo "==> Tipos do OpenAPI"
node scripts/gen-api-types.mjs --check

echo "==> Backend: fmt, clippy e testes"
(
  cd backend
  cargo fmt --check
  cargo clippy --all-targets -- -D warnings
  cargo test
)

echo "==> Frontend: build e testes"
(
  cd frontend
  npm run build
  npm test
)

echo "Tudo certo."
