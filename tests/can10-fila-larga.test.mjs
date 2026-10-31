/* CAN-10: na Fila larga (a partir de 821 px) Cedente e Sacado têm pelo menos 150 px cada, e o redesenho da mesma tela preserva a rolagem */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { carregar } from "./carregar.mjs";

const HTML = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("min-width da #tbl-fila deixa ao menos 150 px para Cedente e para Sacado", () => {
  const m = carregar();
  const cols = m.run("viewFila()").match(/<colgroup>([\s\S]*?)<\/colgroup>/)[1].match(/<col[^>]*>/g);
  const fixas = cols.map(c => (c.match(/width:(\d+)px/) || [])[1]).filter(Boolean).map(Number);
  assert.equal(cols.length - fixas.length, 2, "Cedente e Sacado são as duas colunas sem largura fixa");
  const minW = Number(HTML.match(/@media \(min-width:821px\)\{#tbl-fila\{min-width:(\d+)px\}/)[1]);
  const sobra = minW - fixas.reduce((a, b) => a + b, 0);
  assert.ok(sobra / 2 >= 150, `sobram ${sobra} px para as duas colunas`);
});

test("áreas que rolam têm id estável (rol-*)", () => {
  const m = carregar();
  assert.match(m.run("viewFila()"), /<div class="tbl-wrap" id="rol-fila"/);
  assert.match(m.run("viewPend()"), /<div class="tbl-wrap" id="rol-pend"/);
  assert.match(m.run(`viewCaso("K7Q2-74")`), /<div class="card-b" id="rol-hist"[^>]*aria-labelledby="t-hist"/);
  for (const t of ["cedentes", "remetentes", "templates"]) {
    m.run(`UI.cfgTab = "${t}"`);
    assert.match(m.run("viewConfig()"), new RegExp(`<div class="tbl-wrap" id="rol-cfg-${t}"`));
  }
});

/* simula o DOM antes do redesenho: a área #id rolada em (left, top) */
function rolada(m, id, left, top) {
  m.run(`document.querySelectorAll = s => /rol-/.test(s) ? [{ id: "${id}", scrollLeft: ${left}, scrollTop: ${top} }] : []`);
}

test("marcar linha, filtrar e o relógio redesenham a Fila sem zerar a rolagem horizontal", () => {
  const m = carregar();
  m.run(`location.hash = "#fila"; render()`);
  rolada(m, "rol-fila", 44, 0);
  m.clicar({ act: "sel", id: "K7Q2-91" }, { checked: true });
  assert.equal(m.els.get("#rol-fila").scrollLeft, 44);
  m.els.delete("#rol-fila"); rolada(m, "rol-fila", 60, 0);
  m.filtro("fila.canal", "EMAIL");
  assert.equal(m.els.get("#rol-fila").scrollLeft, 60);
  m.els.delete("#rol-fila"); rolada(m, "rol-fila", 75, 0);
  m.run("render()");
  assert.equal(m.els.get("#rol-fila").scrollLeft, 75);
});

test("ação no detalhe mantém a posição do Histórico; trocar de tela não carrega a rolagem", () => {
  const m = carregar();
  m.run(`location.hash = "#caso/K7Q2-74"; render()`);
  rolada(m, "rol-hist", 0, 380);
  m.clicar({ act: "histF", k: "ev" });
  assert.equal(m.els.get("#rol-hist").scrollTop, 380);
  m.els.delete("#rol-hist");
  m.run(`location.hash = "#caso/K7Q2-61"; render()`);
  assert.equal(m.els.has("#rol-hist"), false, "rota nova começa do topo");
});
