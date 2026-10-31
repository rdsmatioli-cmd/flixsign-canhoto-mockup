/* CAN-11: a busca por protocolo ou NF fica disponível de 821 a 1280 px (bloco do usuário compacto) e, no celular, por um botão na barra superior */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { carregar } from "./carregar.mjs";

const HTML = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const CSS = HTML.match(/<style>([\s\S]*?)<\/style>/)[1];
/* corpo de cada @media (max-width:Npx){...}, com chaves balanceadas */
function medias(n) {
  const out = []; const tag = `@media (max-width:${n}px){`; let i = 0;
  while ((i = CSS.indexOf(tag, i)) >= 0) { let d = 1, j = i + tag.length; while (d && j < CSS.length) { if (CSS[j] === "{") d++; else if (CSS[j] === "}") d--; j++; } out.push(CSS.slice(i + tag.length, j - 1)); i = j; }
  return out.join("\n");
}
const esconde = (bloco, sel) => new RegExp(`(^|[},])\\s*${sel.replace(".", "\\.")}\\s*(,[^{]*)?\\{display:none`).test(bloco);

test("de 821 a 1280 px a busca não é escondida; o bloco do usuário fica só com o avatar", () => {
  assert.equal(esconde(medias(1280), ".search"), false, "@media 1280 não esconde .search");
  assert.equal(esconde(medias(1100), ".search"), false, "@media 1100 não esconde .search");
  assert.match(medias(1280), /\.user \.who\{position:absolute;width:1px;height:1px/);
  assert.match(HTML, /<div class="user" title="Ana Ribeiro · Supervisora · Flixsign">/);
});

test("no celular a busca abre por um botão com aria-expanded e aria-controls", () => {
  assert.match(HTML, /<button class="btn ghost search-btn" type="button" id="gsearch-btn" data-act="gsearch" aria-expanded="false" aria-controls="gsearch-box" aria-label="Buscar caso">/);
  assert.match(HTML, /<div class="search" id="gsearch-box" role="search">/);
  assert.match(CSS, /\.btn\.search-btn\{display:none/, "botão escondido fora do celular, com especificidade acima de .btn{display:inline-flex}");
  const m820 = medias(820);
  assert.ok(esconde(m820, ".search"), "fechada no celular");
  assert.match(m820, /\.search-btn\{display:inline-flex/);
  assert.match(m820, /\.topbar\.busca \.search\{display:block;order:5;flex:1 1 100%\}/);
});

test("botão abre e fecha a busca; Enter abre o caso e fecha a busca; Esc fecha e devolve o foco ao botão", () => {
  const m = carregar();
  const aberta = () => m.els.get("#topbar").classList.contains("busca");
  m.clicar({ act: "gsearch" });
  assert.equal(aberta(), true);
  assert.equal(m.els.get("#gsearch-btn").getAttribute("aria-expanded"), "true");
  assert.equal(m.focos.at(-1), "#gsearch");
  const gs = m.els.get("#gsearch"); gs.value = "K7Q2-74";
  gs.disparar("keydown", { key: "Enter", target: gs });
  assert.equal(m.run("location.hash"), "#caso/K7Q2-74");
  assert.equal(gs.value, "");
  assert.equal(aberta(), false);
  assert.equal(m.els.get("#gsearch-btn").getAttribute("aria-expanded"), "false");
  m.clicar({ act: "gsearch" });
  gs.disparar("keydown", { key: "Escape", target: gs });
  assert.equal(aberta(), false);
  assert.equal(m.focos.at(-1), "#gsearch-btn");
  m.clicar({ act: "gsearch" }); m.clicar({ act: "gsearch" });
  assert.equal(aberta(), false, "segundo clique fecha");
});

test("buscar o caso que já está aberto leva o foco ao título dele", () => {
  const m = carregar();
  m.run(`location.hash = "#caso/K7Q2-61"; render()`);
  const gs = m.els.get("#gsearch"); gs.value = "771204";
  m.focos.length = 0;
  gs.disparar("keydown", { key: "Enter", target: gs });
  assert.equal(m.run("location.hash"), "#caso/K7Q2-61");
  assert.equal(m.focos.at(-1), "#view h1");
});
