/* CAN-09: ação indisponível continua focável (aria-disabled), sem efeito no clique, e o motivo está em texto visível ligado por aria-describedby */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { carregar, texto } from "./carregar.mjs";

const botao = (html, act) => html.match(new RegExp(`<button[^>]*data-act="${act}"[^>]*>`))[0];
const porId = (html, id) => { const m = html.match(new RegExp(`id="${id}"[^>]*>([^<]*)<`)); return m && m[1]; };

test("detalhe do K7Q2-74: as 5 ações indisponíveis são focáveis e descritas pelo motivo visível", () => {
  const m = carregar();
  const html = m.run(`viewCaso("K7Q2-74")`);
  const av = JSON.parse(m.run(`JSON.stringify(avail(byId("K7Q2-74")))`));
  const ind = Object.keys(av).filter(k => !av[k][0]);
  assert.deepEqual(ind.sort(), ["assumir", "corrigir", "desfazer", "reprocessar", "vincular"]);
  for (const k of ind) {
    const b = botao(html, k);
    assert.match(b, /aria-disabled="true"/, k);
    assert.match(b, new RegExp(`aria-describedby="why-${k}"`), k);
    assert.doesNotMatch(b, /\sdisabled|title=/, `${k}: sem disabled nativo nem motivo só no title`);
    assert.equal(porId(html, `why-${k}`), av[k][1], `${k}: motivo visível`);
  }
  for (const k of ["lancar", "descartar"]) assert.doesNotMatch(botao(html, k), /aria-disabled|aria-describedby/, k);
  assert.match(texto(html), /Indisponíveis neste caso/);
  assert.doesNotMatch(texto(html), /passe o mouse/i);
});

test("clicar numa ação indisponível não faz nada", () => {
  const m = carregar();
  const indisponivel = { getAttribute: k => (k === "aria-disabled" ? "true" : null) };
  m.clicar({ act: "corrigir", id: "K7Q2-74" }, indisponivel);
  assert.equal(m.modal(), "");
  m.clicar({ act: "lancar", id: "K7Q2-86" }, indisponivel);
  assert.equal(m.modal(), "");
  const resp = m.run(`byId("K7Q2-86").resp`);
  m.clicar({ act: "assumir", id: "K7Q2-86" }, indisponivel);
  assert.equal(m.run(`byId("K7Q2-86").resp`), resp);
  m.clicar({ act: "corrigir", id: "K7Q2-86" });
  assert.match(m.modal(), /Corrigir NF/, "a mesma ação disponível abre o diálogo");
});

test("Abrir no NetFactor e Marcar como lançado (lote): focáveis, com o motivo visível", () => {
  const m = carregar();
  const det = m.run(`viewCaso("K7Q2-74")`);
  const nf = det.match(/<button[^>]*>(?:(?!<\/button>)[\s\S])*Abrir no NetFactor<\/button>/)[0];
  assert.match(nf, /aria-disabled="true" aria-describedby="why-nf"/);
  assert.doesNotMatch(nf, /\sdisabled|title=/);
  assert.match(porId(det, "why-nf"), /URL estável/);
  m.run(`location.hash = "#fila"`);
  const fila = m.run("viewFila()");
  const lote = fila.match(/<button[^>]*>Marcar como lançado \(lote\)<\/button>/)[0];
  assert.match(lote, /aria-disabled="true" aria-describedby="why-lote"/);
  assert.doesNotMatch(lote, /\sdisabled|title=/);
  assert.match(porId(fila, "why-lote"), /fora do MVP/);
});

test("Configurações: opções indisponíveis dizem o motivo em texto, não em title", () => {
  const m = carregar();
  const html = m.run("viewConfig()");
  const dis = [...html.matchAll(/<label class="opt dis"[^>]*>[\s\S]*?<\/label>/g)].map(x => x[0]);
  assert.equal(dis.length, 3);
  for (const l of dis) assert.doesNotMatch(l.match(/<label[^>]*>/)[0], /title=/);
  assert.match(texto(dis[0]), /Indisponível até a liberação da API pela OrderBy/);
  assert.match(texto(dis[1]), /Indisponível: depende das capacidades \(c\) e \(d\)/);
  assert.match(texto(dis[2]), /Indisponível neste ambiente/);
});

test("anel de foco dos botões é contorno sólido com contraste de 3:1 ou mais sobre os fundos da página", () => {
  const CSS = readFileSync(new URL("../index.html", import.meta.url), "utf8").match(/<style>([\s\S]*?)<\/style>/)[1];
  const regra = CSS.match(/\.btn:focus-visible\{([^}]*)\}/)[1];
  assert.match(regra, /outline:2px solid var\(--accent\)/);
  assert.doesNotMatch(regra, /outline:none/);
  const cor = nome => CSS.match(new RegExp(`--${nome}:(#[0-9a-f]{6})`))[1];
  const lum = h => { const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contraste = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  for (const fundo of ["surface", "surface-2", "bg"]) {
    const c = contraste(cor("accent"), cor(fundo));
    assert.ok(c >= 3, `anel sobre --${fundo}: ${c.toFixed(2)}:1`);
  }
});
