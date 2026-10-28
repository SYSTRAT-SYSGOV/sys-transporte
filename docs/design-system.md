# Design System SYSGOV — web-client

Guia do design system usado pelo console de transporte escolar. A base são as
primitivas do [shadcn/ui](https://ui.shadcn.com/) sobre Radix UI, com tokens e
componentes de aplicação próprios do SYSGOV.

A documentação viva fica dentro do próprio console, em **Administração → Design
system** (`/design-system`), acessível a quem possui `identity.user.manage`.

## Princípios

1. **Reuso antes de criação** — consulte `frontend/src/components/ui/` antes de
   escrever marcação nova.
2. **Acessibilidade por padrão** — todo controle tem rótulo associado, foco
   visível e navegação por teclado; diálogos usam Radix.
3. **Consistência visual** — nenhuma cor, espaçamento ou tipografia é definida
   fora dos tokens de `src/index.css`.
4. **Dados técnicos em mono** — placas, RENAVAM, CNH, códigos INEP, datas,
   percentuais e métricas usam JetBrains Mono com `tabular-nums`.
5. **Estados completos** — toda tela contempla carregamento, vazio e erro.

## Estrutura

```
frontend/
├── components.json              # configuração do shadcn/ui (new-york, lucide)
└── src/
    ├── index.css                # tokens SYSGOV + Tailwind v4
    ├── lib/utils.ts             # cn() = clsx + tailwind-merge
    └── components/ui/
        ├── <primitivas>.tsx     # componentes shadcn/ui
        ├── app.tsx              # camada de aplicação SYSGOV
        ├── index.ts             # barril de exportação
        └── app.test.tsx         # testes dos componentes de aplicação
```

Imports do frontend usam o alias `@sysgov/ui`, que aponta para
`frontend/src/components/ui` e cumpre o papel do pacote compartilhado
`@sysgov/ui` do monorepo SYSGOV:

```tsx
import { Button, DataTable, FormField, useConfirm } from "@sysgov/ui";
```

## Tokens

Definidos como CSS variables em `src/index.css` e expostos ao Tailwind em
`@theme inline`.

| Token                          | Classe                           | Uso                                                        |
| ------------------------------ | -------------------------------- | ---------------------------------------------------------- |
| `--primary`                    | `bg-primary` / `text-primary`    | Azul GOV.BR (`#1351b4`) como ação principal, link e foco   |
| `--gov-primary-hover`          | `bg-gov-primary-hover`           | Hover e títulos institucionais (`#0c326f`)                 |
| `--gov-primary-light`          | `bg-gov-primary-light`           | Item ativo, ícones e realces (`#e8f0fe`)                   |
| `--gov-primary-border`         | `border-gov-primary-border`      | Bordas de destaque (`#c5d8f6`)                             |
| `--success`                    | `bg-success`                     | Conformidade, vistoria válida, ocupação normal (`#168821`) |
| `--warning`                    | `bg-warning`                     | Documento a vencer, ocupação acima de 80% (`#f2a71b`)      |
| `--critical` / `--destructive` | `bg-critical` / `bg-destructive` | Vencido, superlotação, erro bloqueante (`#e52207`)         |
| `--info`                       | `bg-info`                        | Informação contextual e censo (`#155bcb`)                  |
| `--gov-blue`                   | `bg-gov-blue`                    | Azul institucional (`#1351b4`)                             |
| `--gov-blue-dark`              | `bg-gov-blue-dark`               | Azul institucional escuro (`#0c326f`)                      |
| `--gov-blue-darker`            | `bg-gov-blue-darker`             | Azul institucional mais escuro (`#071d41`)                 |
| `--sidebar`                    | `bg-sidebar`                     | Sidebar branca do web-client (`#ffffff`)                   |
| `--sidebar-accent`             | `bg-sidebar-accent`              | Item ativo da navegação (`#e8f0fe`)                        |
| `--sidebar-border`             | `border-sidebar-border`          | Divisores da sidebar (`#d8dce0`)                           |
| `--background` / `--gov-page`  | `bg-background` / `bg-gov-page`  | Fundo de página (`#f8f9fa`)                                |
| `--card` / `--gov-surface`     | `bg-card` / `bg-gov-surface`     | Superfícies (`#ffffff`)                                    |
| `--border` / `--input`         | `border-border` / `border-input` | Bordas (`#d8dce0`)                                         |
| `--radius`                     | `rounded-md` / `rounded-lg`      | Raios                                                      |

**Tipografia**

- `font-sans`: Inter Variable — texto institucional.
- `font-mono`: JetBrains Mono Variable — valores técnicos e numéricos.
- Corpo em 14px; títulos com tracking negativo; hierarquia por peso.
- Títulos `h1`/`h2`, `CardTitle` e cabeçalhos de seção usam `#0c326f` e peso 700.

**Tema** — o console opera em tema claro, com sidebar e login claros, como o
`apps/web-client` do SYSGOV. Os tokens escuros existem em `.dark`, mas não há
alternador exposto na interface.

## Componentes

### Primitivas shadcn/ui

| Componente                                | Arquivo             | Uso típico                          |
| ----------------------------------------- | ------------------- | ----------------------------------- |
| `Alert`, `AlertTitle`, `AlertDescription` | `alert.tsx`         | Avisos contextuais                  |
| `Avatar`, `AvatarFallback`                | `avatar.tsx`        | Identidade do usuário               |
| `Badge`                                   | `badge.tsx`         | Rótulos e situações                 |
| `Button`                                  | `button.tsx`        | Ações e variantes                   |
| `Card` + subcomponentes                   | `card.tsx`          | Agrupamento de conteúdo             |
| `Checkbox`                                | `checkbox.tsx`      | Seleção múltipla                    |
| `Dialog` + subcomponentes                 | `dialog.tsx`        | Diálogos modais                     |
| `DropdownMenu`                            | `dropdown-menu.tsx` | Menus de ações                      |
| `Input`                                   | `input.tsx`         | Campo de texto                      |
| `Label`                                   | `label.tsx`         | Rótulo acessível                    |
| `NativeSelect`                            | `native-select.tsx` | Select nativo em formulários densos |
| `Popover`                                 | `popover.tsx`       | Conteúdo flutuante                  |
| `Progress`                                | `progress.tsx`      | Barra de lotação                    |
| `ScrollArea`                              | `scroll-area.tsx`   | Áreas roláveis                      |
| `Select`                                  | `select.tsx`        | Select Radix com busca visual       |
| `Separator`                               | `separator.tsx`     | Divisores                           |
| `Sheet`                                   | `sheet.tsx`         | Painel lateral (menu mobile)        |
| `Skeleton`                                | `skeleton.tsx`      | Carregamento                        |
| `Toaster`                                 | `sonner.tsx`        | Notificações                        |
| `Switch`                                  | `switch.tsx`        | Alternância booleana                |
| `Table`                                   | `table.tsx`         | Tabelas                             |
| `Tabs`                                    | `tabs.tsx`          | Abas de conteúdo                    |
| `Textarea`                                | `textarea.tsx`      | Texto longo                         |
| `Tooltip`                                 | `tooltip.tsx`       | Dica contextual                     |

### Camada de aplicação (`app.tsx`)

| Componente                       | Responsabilidade                                    |
| -------------------------------- | --------------------------------------------------- |
| `PageHeader`                     | Título, descrição e ações da página                 |
| `StatCard`                       | Indicador com rótulo, valor e ícone                 |
| `SectionCard`                    | Cartão de seção com título e ação                   |
| `Modal`                          | Diálogo padronizado com rodapé opcional             |
| `DataTable`                      | Tabela com colunas declarativas, skeleton e vazio   |
| `Pagination`                     | Paginação com totais em mono                        |
| `FormField`                      | Rótulo + erro + `aria-describedby`                  |
| `SearchBar`                      | Busca com submit acessível                          |
| `ErrorBanner`                    | Faixa de erro `problem+json`                        |
| `EmptyState`                     | Estado vazio com ação opcional                      |
| `StatusBadge`                    | Situação com tom semântico                          |
| `Toolbar`                        | Barra de filtros e ações                            |
| `MonoValue`                      | Valor técnico em fonte monoespaçada                 |
| `CheckboxField`                  | Checkbox com rótulo e descrição                     |
| `SwitchField`                    | Switch com rótulo e descrição                       |
| `ConfirmProvider` / `useConfirm` | Confirmação assíncrona no lugar de `window.confirm` |

## Padrões

### Formulários

```tsx
<FormField label="Código INEP" error={fieldError(save.error, "inep_code")}>
  <Input value={form.inep_code ?? ""} onChange={...} />
</FormField>

<CheckboxField
  label="Escola ativa"
  description="Inativas saem das listagens padrão."
  checked={form.is_active}
  onCheckedChange={(is_active) => setForm({ ...form, is_active })}
/>
```

- Erros de conflito (`409`) aparecem em `ErrorBanner`; erros por campo, abaixo do
  input.
- `FormField` injeta `id`, `aria-invalid` e `aria-describedby` no primeiro filho.

### Tabelas

Use `DataTable` com colunas declarativas; marque `numeric` para alinhamento à
direita e fonte mono. Sempre informe `loading`, `empty` e `keyOf`.

### Confirmação

```tsx
const confirm = useConfirm();

const ok = await confirm({
  title: "Inativar o veículo ABC1D23?",
  description: "O histórico de vistorias é preservado.",
  confirmLabel: "Inativar",
  destructive: true,
});
```

`ConfirmProvider` já envolve a aplicação em `App.tsx`. Não use
`window.confirm`.

### Notificações

```tsx
import { toast } from "sonner";

toast.success("Vistoria registrada.");
toast.error("Falha ao salvar a alocação.");
```

O `<Toaster />` é montado uma única vez em `App.tsx`, no canto superior direito.

### Sobreposições

- `Modal` para formulários e detalhes.
- `Sheet` para navegação mobile.
- `DropdownMenu` para ações secundárias.
- `Popover` para filtros e conteúdo complementar.
- `Tooltip` para ícones sem texto visível.

## Acessibilidade

- Todo `Button` apenas com ícone exige `aria-label`.
- `Modal` sempre tem `DialogTitle`; `Modal` gera uma descrição oculta.
- Não remova o anel de foco (`focus-visible:ring-*`).
- Use `StatusBadge` com texto, não apenas cor, para indicar situação.
- `DataTable` mantém cabeçalhos semânticos via `TableHead`.
- Atalhos `Alt + letra` são ignorados quando o foco está em campos de entrada.

## Adicionando componentes shadcn/ui

```bash
cd frontend
npx shadcn@latest add <componente>
```

Regras:

1. Preserve as customizações SYSGOV dos arquivos já existentes; responda **não**
   ao prompt de sobrescrita.
2. Ajuste imports gerados para `@/lib/utils` e `@sysgov/ui`.
3. Exporte o componente novo em `src/components/ui/index.ts`.
4. Registre o uso na página `/design-system` e, se for componente de aplicação,
   adicione teste em `app.test.tsx`.
5. Rode `npm run format`, `npm test` e `npm run build`.

## Verificação

```bash
cd frontend
npx tsc --noEmit
npm test
npm run build
```

A página `/design-system` cobre tokens, ações, formulários, dados, feedback e
sobreposições, servindo como referência visual e teste manual rápido.
