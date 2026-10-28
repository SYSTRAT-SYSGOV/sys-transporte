# DESIGN_SYSTEM — web-client SYSGOV

Contrato de UI obrigatório para agentes de IA e desenvolvedores neste
repositório. Aplique estas regras a todo componente, página ou ajuste visual.

> **Escopo deste repositório.** Este projeto é o **web-client** standalone de
> transporte escolar (React 19 + Vite + TypeScript + Tailwind CSS v4) com API em
> Rust/MySQL. As diretrizes do monorepo SYSGOV que dependem de Laravel, módulos
> `Modules/*` e tabelas multi-tenant não se aplicam aqui. O contrato visual,
> tipográfico e de componentes se aplica integralmente.

---

## 1. Paleta — GOV.BR azul

O web-client usa a paleta **GOV.BR azul**, a mesma do `apps/web-client` do
SYSGOV, e **não** a Dark Navy do painel admin. A sidebar é **branca**, o login é
claro e os títulos institucionais são `#0c326f`. Cores são definidas apenas como
tokens em `frontend/src/index.css` e expostas ao Tailwind em `@theme inline`.

| Token                          | Valor     | Uso                                    |
| ------------------------------ | --------- | -------------------------------------- |
| `--background` / `--gov-page`  | `#f8f9fa` | Fundo das páginas                      |
| `--primary` / `--gov-primary`  | `#1351b4` | Ação principal, links, foco            |
| `--primary-foreground`         | `#ffffff` | Texto sobre azul                       |
| `--gov-primary-hover`          | `#0c326f` | Hover, títulos e ícones institucionais |
| `--gov-primary-active`         | `#071d41` | Azul profundo, logo e estados ativos   |
| `--gov-primary-light`          | `#e8f0fe` | Item ativo, ícones e realces suaves    |
| `--gov-primary-border`         | `#c5d8f6` | Bordas de destaque azul                |
| `--sidebar`                    | `#ffffff` | Sidebar do App Shell                   |
| `--sidebar-accent`             | `#e8f0fe` | Item ativo da navegação                |
| `--sidebar-border`             | `#d8dce0` | Divisores da sidebar                   |
| `--success`                    | `#168821` | Conformidade e ocupação normal         |
| `--warning`                    | `#f2a71b` | Documento a vencer, atenção            |
| `--critical` / `--destructive` | `#e52207` | Erro, vencido, superlotação            |
| `--info`                       | `#155bcb` | Informação contextual                  |
| `--gov-accent-gold`            | `#f6a609` | Destaque institucional pontual         |
| `--gov-accent-yellow`          | `#ffcd07` | Acento GOV.BR                          |

Regras:

- **Nunca** hard-code hex em componente; use `bg-primary`,
  `bg-gov-primary-light`, `bg-sidebar`, `text-gov-blue-dark`, etc.
- A sidebar e o login são claros; superfícies escuras ficam restritas a
  elementos pontuais (logo, ícones e estados ativos).
- Títulos `h1`/`h2`, `CardTitle` e cabeçalhos de seção usam `#0c326f`.
- Estados nunca dependem só de cor: sempre acompanham texto ou ícone.

---

## 2. Tipografia técnica — JetBrains Mono é obrigatório

Todo **dado numérico, monetário, percentual, CPF, CNPJ, placa, RENAVAM, CNH,
código, data e métrica** usa `font-mono tabular-nums` (JetBrains Mono).

- Prefira o componente `MonoValue` de `@sysgov/ui` em tabelas e detalhes.
- Datas e percentuais em células de tabela também são dados técnicos.
- Inter (sans) fica para rótulos, títulos e texto corrido.

---

## 3. Componentes — `@sysgov/ui` é obrigatório

Este repositório mapeia o pacote compartilhado para
`frontend/src/components/ui` por meio do alias `@sysgov/ui` (TS + Vite).

```tsx
import { Button, Card, Modal, DataTable } from "@sysgov/ui";
```

Regras:

1. **Antes de criar**, verifique `frontend/src/components/ui/index.ts`.
2. **Nunca reimplemente** localmente um primitivo que já existe no pacote
   (Card, Badge, Modal, Button, Input, Select etc.).
3. Componente novo e genérico nasce em `frontend/src/components/ui/`, seguindo
   shadcn/ui real (Radix + `class-variance-authority` + `cn()`), e é exportado
   no barril `index.ts`.
4. Componente específico de uma tela pode ficar em `frontend/src/components/`,
   mas **composto** pelos primitivos de `@sysgov/ui`.
5. A camada de aplicação (`app.tsx`) concentra padrões SYSGOV: `PageHeader`,
   `StatCard`, `SectionCard`, `DataTable`, `FormField`, `Toolbar`, `MonoValue`,
   `CheckboxField`, `SwitchField`, `ConfirmProvider`/`useConfirm`.
6. A página viva do design system fica em `/design-system`; todo componente novo
   deve ser demonstrado lá.

### Proibições

- `window.confirm`, `alert` e `prompt` nativos — use `useConfirm` e `toast`.
- CSS inline, emojis, SVGs soltos — ícones vêm de `lucide-react`.
- Cores, raios e fontes fora dos tokens.
- Criar um "Card" com `<div className="...">` dentro de uma tela.

---

## 4. Acessibilidade

- Controles sempre com rótulo associado (`Label`/`FormField`).
- Botão apenas com ícone exige `aria-label`.
- Diálogos sempre com título; foco visível preservado.
- Tabelas com cabeçalhos semânticos; status com texto além da cor.
- Atalhos `Alt + letra` não disparam dentro de campos de entrada.

---

## 5. Verificação

```bash
cd frontend
npx tsc --noEmit
npm test
npm run build
npm run format:check
```

Consulte também [`docs/design-system.md`](docs/design-system.md) para o catálogo
completo e [`docs/console.md`](docs/console.md) para as telas.
