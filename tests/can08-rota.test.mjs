/* CAN-08: troca de tela leva o foco ao título da nova tela, Voltar devolve ao link do caso, menu com aria-current e link para pular ao conteúdo */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { carregar } from "./carregar.mjs";

const HTML = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const ir = (m, hash) => { m.run(`location.hash = "${hash}"; render()`); return m.focos.at(-1); };

test("toda tela tem o h1 focável por script (tabindex=-1)", () => {
  const m = carregar();
  for (const v of ["viewDashboard()", "viewFila()", "viewPend()", `viewCaso("K7Q2-61")`, "viewWA()", "viewEmail()", "viewConfig()"]) {
    const h1 = m.run(v).match(/<h1[^>]*>/)[0];
    assert.match(h1, /tabindex="-1"/, v);
  }
});

test("carga inicial não move o foco; tela nova foca o h1; Voltar do caso foca o link do caso na lista", () => {
  const m = carregar();
  assert.deepEqual(m.focos, []);
  assert.equal(ir(m, "#fila"), "#view h1");
  assert.equal(ir(m, "#caso/K7Q2-61"), "#view h1");
  assert.equal(ir(m, "#fila"), '#view a[href="#caso/K7Q2-61"]');
  ir(m, "#caso/K7Q2-86");
  assert.equal(ir(m, "#pendencias"), '#view a[href="#caso/K7Q2-86"]');
});

test("barra de motivo da Visão geral leva às Pendências com o foco no título", () => {
  const m = carregar();
  m.clicar({ act: "goPend", mot: "FOTO_ILEGIVEL" });
  assert.equal(m.run("location.hash"), "#pendencias");
  assert.equal(ir(m, "#pendencias"), "#view h1");
});

test("menu: aria-current=page na tela atual e true na lista de origem do caso", () => {
  const m = carregar();
  assert.equal(m.run(`ariaAtual("fila", "fila")`), "page");
  assert.equal(m.run(`ariaAtual("dashboard", "fila")`), null);
  ir(m, "#pendencias"); ir(m, "#caso/K7Q2-86");
  assert.equal(m.run(`ariaAtual("pendencias", "caso")`), "true");
  assert.equal(m.run(`ariaAtual("fila", "caso")`), null);
});

test("link Pular para o conteúdo é o primeiro da página e leva o foco ao título da tela", () => {
  const m = carregar();
  assert.match(HTML, /<div class="app">\s*<a class="skip" href="#view" data-act="skip">Pular para o conteúdo<\/a>/);
  m.clicar({ act: "skip" });
  assert.equal(m.focos.at(-1), "#view h1");
  assert.equal(m.run("location.hash"), "", "não troca a rota");
});

test("voltar do caso para a tela de onde ele foi aberto (E-mail, WhatsApp) foca o link do caso", () => {
  const m = carregar();
  ir(m, "#email");
  assert.equal(ir(m, "#caso/K7Q2-93"), "#view h1");
  assert.equal(ir(m, "#email"), '#view a[href="#caso/K7Q2-93"]');
  ir(m, "#whatsapp");
  ir(m, "#caso/K7Q2-91");
  assert.equal(ir(m, "#whatsapp"), '#view a[href="#caso/K7Q2-91"]');
});

test("ir do caso para outra tela que não é a de origem nem lista foca o h1", () => {
  const m = carregar();
  ir(m, "#fila");
  ir(m, "#caso/K7Q2-93");
  assert.equal(ir(m, "#email"), "#view h1", "o caso foi aberto da Fila, não do E-mail");
  ir(m, "#email"); ir(m, "#caso/K7Q2-93");
  assert.equal(ir(m, "#whatsapp"), "#view h1");
  ir(m, "#caso/K7Q2-93");
  assert.equal(ir(m, "#email"), "#view h1", "aberto de outra tela (WhatsApp)");
});
