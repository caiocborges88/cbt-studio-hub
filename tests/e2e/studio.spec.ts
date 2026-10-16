import { test, expect, type Page } from "@playwright/test";
async function nav(page: Page, label: string) {
  const menu = page.getByRole("button", { name: "Abrir navegação" });
  if (
    (await menu.isVisible()) &&
    !(await page.locator("aside.sidebar.open").isVisible())
  )
    await menu.click();
  await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("button", { name: label, exact: true })
    .click();
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Olá, Explorador/ }),
  ).toBeVisible();
});
test("dashboard, mobile layout, theme and stage changes preserve progress", async ({
  page,
}, info) => {
  await page.screenshot({
    path: ".local/" + info.project.name + "-home.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await nav(page, "Preferências");
  await page.getByRole("button", { name: /Acadêmica/ }).click();
  await page.getByLabel("Etapa de estudo").selectOption("superior");
  await page.getByRole("button", { name: "Salvar preferências" }).click();
  await expect(page.getByRole("status")).toContainText("preservado");
  await nav(page, "Meu espaço");
  await expect(
    page.getByRole("heading", { name: "Seu próximo passo começa aqui." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Como construímos conhecimento?" }),
  ).toBeVisible();
  await page.screenshot({
    path: ".local/" + info.project.name + "-academic.png",
    fullPage: true,
    animations: "disabled",
  });
});
test("five-format journey, hints, matching and keyboard ordering", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Começar uma jornada" }).click();
  await expect(
    page.getByText("Por que Lia decidiu regar as mudas?"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Porque a terra estava seca/ })
    .click();
  await page.getByRole("button", { name: "Confirmar resposta" }).click();
  await expect(page.getByRole("status").last()).toContainText("Você acertou");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Preciso de uma dica" }).click();
  await expect(page.locator(".hint-box")).toBeVisible();
  await page.getByRole("button", { name: "raízes", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar resposta" }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Raiz", exact: true }).click();
  await page
    .getByRole("button", { name: "Absorve água do solo", exact: true })
    .click();
  await page.getByRole("button", { name: "Caule", exact: true }).click();
  await page
    .getByRole("button", { name: "Sustenta e transporta", exact: true })
    .click();
  await page.getByRole("button", { name: "Folha", exact: true }).click();
  await page
    .getByRole("button", { name: "Participa da fotossíntese", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirmar resposta" }).click();
  await expect(page.getByRole("status").last()).toContainText("Você acertou");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Mover item 1 para baixo" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Mover item 2 para baixo" }).click();
  await page.getByRole("button", { name: "Confirmar resposta" }).click();
  await expect(page.getByRole("status").last()).toContainText("Você acertou");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Verdadeiro", exact: false }).click();
  await page.getByRole("button", { name: "Confirmar resposta" }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Você chegou até aqui!" }),
  ).toBeVisible();
  await nav(page, "Meu progresso");
  await expect(page.getByText("Acertos com apoio")).toBeVisible();
});
test("retry, material consultation and session resumption", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Começar uma jornada" }).click();
  await page.getByRole("button", { name: "Consultar material" }).click();
  await expect(page.getByRole("dialog")).toContainText("Na horta da escola");
  await page.getByRole("button", { name: "Fechar material" }).click();
  await page.getByRole("button", { name: /Porque estava chovendo/ }).click();
  await page.getByRole("button", { name: "Confirmar resposta" }).click();
  await expect(
    page.getByText("Uma nova oportunidade de entender."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await page
    .getByRole("button", { name: /Porque a terra estava seca/ })
    .click();
  await page.getByRole("button", { name: "Confirmar resposta" }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Sair e continuar depois" }).click();
  await page.getByRole("button", { name: "Continuar de onde parei" }).click();
  await expect(page.getByLabel("Complete a lacuna")).toBeVisible();
});
test("create, preview, publish and play programmatically verified math", async ({
  page,
}) => {
  await nav(page, "Criar atividades");
  await page.getByRole("button", { name: "Exercícios de matemática" }).click();
  await page.getByLabel("Título da trilha").fill("Matemática de teste");
  await page.getByLabel("Disciplina", { exact: true }).fill("Matemática");
  await page.getByLabel("Quantidade", { exact: true }).fill("2");
  await page
    .getByRole("button", { name: "Criar exercícios conferidos" })
    .click();
  await expect(page.getByText("Conferência aritmética:").first()).toBeVisible();
  await page
    .getByRole("button", { name: "Experimentar atividade" })
    .first()
    .click();
  await expect(page.getByText("PRÉVIA DO ESTUDANTE")).toBeVisible();
  await page.getByRole("button", { name: "Publicar trilha" }).click();
  await expect(page.getByRole("status")).toContainText("publicada");
  await nav(page, "Biblioteca");
  await expect(
    page.getByRole("heading", { name: "Matemática de teste" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Estudar Matemática de teste" })
    .click();
  await expect(
    page.getByText("Resposta numérica", { exact: true }),
  ).toBeVisible();
});
test("classification and open responses in practice mode", async ({ page }) => {
  await nav(page, "Biblioteca");
  await page.getByRole("button", { name: "Configurar prática" }).click();
  await page
    .getByRole("combobox", { name: "Formato", exact: true })
    .selectOption("classify");
  await page
    .getByRole("button", { name: "Praticar com estes filtros" })
    .first()
    .click();
  for (const [item, category] of [
    ["A terra estava seca", "Sustentada pelo texto"],
    ["Lia colheu tomates", "Não sustentada pelo texto"],
    ["Lia pegou um regador", "Sustentada pelo texto"],
  ]) {
    await page.getByRole("button", { name: item, exact: false }).click();
    await page
      .getByRole("button", { name: category, exact: false })
      .filter({ has: page.locator("strong") })
      .first()
      .click();
  }
  await page.getByRole("button", { name: "Confirmar resposta" }).click();
  await expect(page.getByText("Você acertou!")).toBeVisible();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await nav(page, "Biblioteca");
  await page.getByRole("button", { name: "Configurar prática" }).click();
  await page
    .getByRole("combobox", { name: "Formato", exact: true })
    .selectOption("open");
  await page
    .getByRole("button", { name: "Praticar com estes filtros" })
    .first()
    .click();
  await page
    .getByLabel("Desenvolva sua resposta")
    .fill("Ela regou com cuidado e decidiu voltar.");
  await page.getByRole("button", { name: "Confirmar resposta" }).click();
  await expect(
    page.getByText("Resposta recebida para avaliação."),
  ).toBeVisible();
});

test("child invitation creates a restricted student session", async ({
  page,
}) => {
  await nav(page, "Meu grupo");
  await page.getByLabel("Apelido do convidado").fill("Lia");
  await page.getByLabel("Entrar sem e-mail com perfil infantil").check();
  await page
    .getByRole("combobox", { name: "Perfil", exact: true })
    .selectOption("demo-child");
  await page.getByRole("button", { name: "Gerar convite privado" }).click();
  const code = await page.locator(".invite-code code").innerText();
  const menu = page.getByRole("button", { name: "Abrir navegação" });
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole("button", { name: "Sair do espaço", exact: true })
    .click();
  await page.getByRole("button", { name: "Tenho um convite" }).click();
  await page.getByLabel("Código de convite").fill(code);
  await page.getByRole("button", { name: "Aceitar convite" }).click();
  await expect(page.getByRole("heading", { name: /Olá, Lia/ })).toBeVisible();
  if (await menu.isVisible()) await menu.click();
  await expect(
    page
      .getByRole("navigation")
      .getByRole("button", { name: "Criar atividades" }),
  ).toHaveCount(0);
  await nav(page, "Biblioteca");
  await page.getByRole("button", { name: "Configurar prática" }).click();
  await page
    .getByRole("combobox", { name: "Formato", exact: true })
    .selectOption("open");
  await page
    .getByRole("button", { name: "Praticar com estes filtros" })
    .first()
    .click();
  await expect(
    page.getByText(
      "Neste perfil, arquivos devem ser enviados pelo responsável ou professor",
      { exact: false },
    ),
  ).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await page.getByLabel("Desenvolva sua resposta").fill("Resposta sem anexos.");
  await page.getByRole("button", { name: "Confirmar resposta" }).click();
  await expect(
    page.getByText("Resposta recebida para avaliação."),
  ).toBeVisible();
});
test("live challenge can start, accept an answer, advance and publish the tied-rank scoreboard", async ({
  page,
}) => {
  await nav(page, "Desafios");
  await page.locator("summary").filter({ hasText: "Criar desafio" }).click();
  await page.getByLabel("Título", { exact: true }).fill("Sala de teste");
  await page
    .getByRole("combobox", { name: "Trilha", exact: true })
    .selectOption("lesson_fundamental-inicial");
  await page
    .getByRole("combobox", { name: "Formato", exact: true })
    .selectOption("live");
  const deadline = await page.evaluate(() => {
    const d = new Date(Date.now() + 3600000);
    const p = (n: number) => String(n).padStart(2, "0");
    return (
      d.getFullYear() +
      "-" +
      p(d.getMonth() + 1) +
      "-" +
      p(d.getDate()) +
      "T" +
      p(d.getHours()) +
      ":" +
      p(d.getMinutes())
    );
  });
  await page.getByLabel("Encerramento").fill(deadline);
  await page
    .getByRole("button", { name: "Criar desafio", exact: true })
    .click();
  await page.getByRole("button", { name: "Participar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Sua sala está pronta." }),
  ).toBeVisible();
  await nav(page, "Desafios");
  await page.getByRole("button", { name: "Iniciar sala" }).click();
  await expect(
    page.getByRole("button", { name: "Próxima atividade", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Participar", exact: true }).click();
  await page
    .getByRole("button", { name: /Porque a terra estava seca/ })
    .click();
  await page.getByRole("button", { name: "Confirmar resposta" }).click();
  await expect(page.getByRole("status").last()).toContainText(
    "Resposta registrada",
  );
  await nav(page, "Desafios");
  await page
    .getByRole("button", { name: "Próxima atividade", exact: true })
    .click();
  await page.getByRole("button", { name: "Encerrar desafio" }).click();
  await page.getByRole("button", { name: "Ver resultados" }).click();
  await expect(page.getByRole("dialog")).toContainText("100 pontos");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
