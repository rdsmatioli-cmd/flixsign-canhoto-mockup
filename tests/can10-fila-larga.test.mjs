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

/* Mini-DOM da Fila a 1280 px, com as medidas do Chromium: a área #rol-fila vai de x 249 a 1255 e as colunas fixas SLA e Ação
   começam em 925 e 1089. O link do protocolo fica em x 292 - scrollLeft; o botão "Marcar como lançado" está na Ação.
   Botão e link existem ou não conforme o HTML que render() acabou de gerar. */
function filaComGeometria(m, id) {
  m.run(`globalThis.getComputedStyle = el => el.estilo || { position: "static", left: "auto", right: "auto" }`);
  const wrap = m.campo("#rol-fila", { clientLeft: 0, clientTop: 0, clientWidth: 1006, clientHeight: 640, getBoundingClientRect: () => ({ left: 249, right: 1255, top: 260, bottom: 900 }) });
  const tr = { children: [] };
  const fixa = (left, right) => ({ parentElement: tr, estilo: { position: "sticky", left: "auto", right }, getBoundingClientRect: () => ({ left, right: left + 164 }) });
  const celProto = { parentElement: tr }, celAcao = fixa(1089, "0px");
  tr.children.push(celProto, fixa(925, "166px"), celAcao);
  const naArea = (cel, x0, x1) => ({ closest: s => (s === "[id^='rol-']" ? wrap : s === "td, th" ? cel : null), getBoundingClientRect: () => ({ left: x0(), right: x1(), top: 400, bottom: 420 }) });
  const sel = { botao: `#view [data-act="lancar"][data-id="${id}"]`, link: `#view a[href="#caso/${id}"]`, outra: `#view [data-act][data-id="${id}"]:not([disabled]):not([aria-disabled="true"])` };
  const view = m.els.get("#view") || m.run(`document.querySelector("#view")`); let html = "";
  view.contains = () => true;
  Object.defineProperty(view, "innerHTML", { get: () => html, set(v) {
    html = v;
    if (v.includes(`data-act="lancar" data-id="${id}"`)) m.campo(sel.botao, { dataset: { act: "lancar", id }, ...naArea(celAcao, () => 1100, () => 1240) }); else m.els.set(sel.botao, null);
    if (v.includes(`href="#caso/${id}"`)) m.campo(sel.link, naArea(celProto, () => 292 - wrap.scrollLeft, () => 370 - wrap.scrollLeft)); else m.els.set(sel.link, null);
    m.els.set(sel.outra, null);
  } });
  return { wrap, sel, html: () => html };
}

test("ajusteVisivel: rola só o necessário, para a esquerda ou para trás das colunas fixas", () => {
  const m = carregar();
  const aj = (r, a) => JSON.parse(m.run(`JSON.stringify(ajusteVisivel(${JSON.stringify(r)}, ${JSON.stringify(a)}))`));
  const area = { l: 249, r: 925, t: 260, b: 900 };
  assert.deepEqual(aj({ left: 52, right: 130, top: 400, bottom: 420 }, area), { dx: -205, dy: 0 });
  assert.deepEqual(aj({ left: 900, right: 980, top: 400, bottom: 420 }, area), { dx: 63, dy: 0 });
  assert.deepEqual(aj({ left: 262, right: 340, top: 400, bottom: 420 }, area), { dx: 0, dy: 0 });
  assert.deepEqual(aj({ left: 262, right: 340, top: 890, bottom: 910 }, area), { dx: 0, dy: 18 });
});

test("lançar pela linha com a Fila rolada: o foco vai ao link do protocolo e a área rola até ele", () => {
  const m = carregar();
  const id = "K7Q2-58";
  const { wrap, sel, html } = filaComGeometria(m, id);
  m.run(`location.hash = "#fila"; render()`);
  rolada(m, "rol-fila", 240, 0); wrap.scrollLeft = 240;
  m.els.get(sel.botao).focus();
  m.clicar({ act: "lancar", id });
  m.campo("#m-ok", { checked: true }); m.campo("input[name=m-img]:checked", { value: "1" }); m.campo("#m-obs", { value: "" });
  m.clicar({ act: "mok" });
  assert.equal(m.run(`byId("${id}").estado`), "CONCLUIDO");
  assert.doesNotMatch(html(), new RegExp(`data-act="(?!lancar")[^"]*"[^>]*data-id="${id}"(?![^>]*disabled)`), "linha lançada sem outra ação habilitada");
  assert.equal(m.focos.at(-1), sel.link, "o foco cai no link do protocolo");
  const r = m.els.get(sel.link).getBoundingClientRect();
  assert.ok(r.left >= 249 && r.right <= 925, `link em x ${r.left} a ${r.right}, fora da área visível 249 a 925`);
  assert.equal(wrap.scrollLeft, 35, "rola só o necessário (240 → 35), sem zerar");
});

test("redesenho com o foco já visível não mexe na rolagem preservada", () => {
  const m = carregar();
  const id = "K7Q2-58";
  const { wrap, sel } = filaComGeometria(m, id);
  m.run(`location.hash = "#fila"; render()`);
  rolada(m, "rol-fila", 240, 0); wrap.scrollLeft = 240;
  m.els.get(sel.botao).focus();
  m.run("render()");
  assert.equal(m.focos.at(-1), sel.botao, "o botão na coluna fixa Ação continua com o foco");
  assert.equal(wrap.scrollLeft, 240, "botão na coluna fixa está sempre visível");
  wrap.scrollLeft = 30;
  m.run(`focar({ sel: 'a[href="#caso/${id}"]', id: "${id}" })`);
  assert.equal(m.focos.at(-1), sel.link);
  assert.equal(wrap.scrollLeft, 30, "link em x 262 a 340 já visível");
});
