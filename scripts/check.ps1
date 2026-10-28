#!/usr/bin/env pwsh
# Executa formatação, lint, testes e build do projeto.
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
    Write-Host "==> Tipos do OpenAPI"
    node scripts/gen-api-types.mjs --check

    Write-Host "==> Backend: fmt"
    Push-Location backend
    try {
        cargo fmt --check
        Write-Host "==> Backend: clippy"
        cargo clippy --all-targets -- -D warnings
        Write-Host "==> Backend: testes"
        cargo test
    }
    finally {
        Pop-Location
    }

    Write-Host "==> Frontend: build e testes"
    Push-Location frontend
    try {
        npm run build
        npm test
    }
    finally {
        Pop-Location
    }

    Write-Host "Tudo certo."
}
finally {
    Pop-Location
}
