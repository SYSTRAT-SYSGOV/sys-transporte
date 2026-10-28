import { expect, test } from "@playwright/test";

const email = process.env.E2E_ADMIN_EMAIL ?? "admin@escola.local";
const password = process.env.E2E_ADMIN_PASSWORD ?? "Admin1234";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(
    page.getByRole("heading", { name: "Painel operacional" }),
  ).toBeVisible({
    timeout: 15_000,
  });
}

function mainNav(page: import("@playwright/test").Page) {
  return page.getByRole("navigation", { name: "Menu principal" });
}

test("autentica e exibe o painel com lotação e alertas", async ({ page }) => {
  await login(page);
  await expect(page.getByText("Lotação por rota")).toBeVisible();
  await expect(page.getByText("Alertas de conformidade")).toBeVisible();
});

test("cadastra uma escola e a lista na tabela", async ({ page }) => {
  await login(page);
  await mainNav(page)
    .getByRole("link", { name: "Escolas", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Escolas" })).toBeVisible();

  const name = `Escola E2E ${Date.now()}`;
  await page.getByRole("button", { name: "Nova escola" }).click();
  await page.getByLabel("Nome").fill(name);
  await page.getByLabel("Código INEP").fill(String(Date.now()).slice(-8));
  await page.getByRole("button", { name: "Salvar" }).click();

  await expect(page.getByRole("cell", { name: new RegExp(name) })).toBeVisible({
    timeout: 15_000,
  });
});

test("abre a rota com mapa e painel de alunos", async ({ page }) => {
  await login(page);
  await mainNav(page).getByRole("link", { name: "Rotas", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Rotas" })).toBeVisible();

  await page.getByRole("link", { name: "Alunos da rota" }).first().click();
  await expect(page.getByText("Alunos alocados")).toBeVisible();
  await expect(page.getByTestId("map-view")).toBeVisible();
});

test("valida o censo e alterna o painel de auditoria", async ({ page }) => {
  await login(page);

  await mainNav(page)
    .getByRole("link", { name: "Censo escolar", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /Censo escolar/ }),
  ).toBeVisible();
  await expect(page.getByText("Pendências")).toBeVisible();

  await mainNav(page)
    .getByRole("link", { name: "Auditoria", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Auditoria" })).toBeVisible();
  await expect(
    page.getByText("Trilha imutável", { exact: false }),
  ).toBeVisible();
});

test("abre a gestão de usuários", async ({ page }) => {
  await login(page);
  await page.goto("/users");
  await expect(page.getByRole("heading", { name: "Usuários" })).toBeVisible();
});
