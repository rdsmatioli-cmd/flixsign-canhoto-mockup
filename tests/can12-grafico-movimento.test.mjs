/* CAN-12: gráfico da Visão geral legível em cartão estreito (7 dias, rótulos de 11 px ou mais), dados em tabela e prefers-reduced-motion respeitado */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { carregar, texto } from "./carregar.mjs";

const HTML = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const CSS = HTML.match(/<style>([\s\S]*?)<\/style>/)[1];
const svg = (html, cls) => html.match(new RegExp(`<svg class="${cls}"[\\s\\S]*?</svg>`))[0];
const diasDo = s => [...s.matchAll(/>(\d\d\/\d\d)<\/text>/g)].map(x => x[1]);
/* corpo do cartão do gráfico a 390 px: 390 − 2×16 (conteúdo) − 2×16 (cartão) − 2 (borda) */
const CORPO_390 = 324;

test("cartão estreito usa o gráfico de 7 dias com rótulos de pelo menos 11 px a 390 px", () => {
  const m = carregar();
  const html = m.run("viewDashboard()");
  const dias = JSON.parse(m.run("JSON.stringify(DAYS.map(d => d[0]))"));
  assert.deepEqual(diasDo(svg(html, "chart-d")), dias);
  const mob = svg(html, "chart-m");
  assert.deepEqual(diasDo(mob), dias.slice(-7));
  const W = Number(mob.match(/viewBox="0 0 (\d+) \d+"/)[1]);
  const fontes = [...mob.matchAll(/<text[^>]*font-size="([\d.]+)"/g)].map(x => Number(x[1]));
  const menor = Math.min(...fontes) * Math.min(CORPO_390, W) / W;
  assert.ok(menor >= 11, `menor rótulo renderiza com ${menor.toFixed(1)} px`);
  assert.match(CSS, /\.card\.grafico\{container:grafico\/inline-size\}/);
  assert.match(CSS, /@container grafico \(max-width:\d+px\)\{\.chart-d,\.per-d\{display:none\}\.chart-m\{display:block\}\.per-m\{display:inline\}\}/);
  assert.match(html, /<div class="card grafico">/);
});

/* largura do cartão do gráfico medida no Chromium: 1280 px → 601, 1366 px → 653, 768 px → 734 (layout de celular, até 820 px) */
const CARTAO = { 768: 734, 1280: 601, 1366: 653 };
/* o SVG ocupa o cartão menos o padding de 16 px de cada lado do .card-b */
const PAD = 32;

test("14 dias só quando os rótulos saem no tamanho nominal; 768, 1280 e 1366 px usam o de 7 dias", () => {
  const m = carregar();
  const lim = Number(CSS.match(/@container grafico \(max-width:(\d+)px\)/)[1]);
  const d = svg(m.run("viewDashboard()"), "chart-d");
  const W = Number(d.match(/viewBox="0 0 (\d+) \d+"/)[1]);
  const fs = Math.min(...[...d.matchAll(/<text[^>]*font-size="([\d.]+)"/g)].map(x => Number(x[1])));
  const menor = fs * (lim + 1 - PAD) / W;
  assert.ok(menor >= fs, `no menor cartão com 14 dias (${lim + 1} px) o rótulo sai com ${menor.toFixed(1)} px, abaixo dos ${fs} px nominais`);
  for (const [vw, c] of Object.entries(CARTAO)) assert.ok(c <= lim, `a ${vw} px o cartão tem ${c} px e cairia no gráfico de 14 dias`);
});

test("destaque só separa o período do resto: com 7 dias o gráfico de 7 dias usa as cores da legenda", () => {
  const m = carregar();
  const escuras = s => (s.match(/fill="#0f766e"|fill="#3949ab"/g) || []).length;
  const html = () => m.run("viewDashboard()");
  const legenda = [...html().match(/<div class="r legend">[\s\S]*?<\/div>/)[0].matchAll(/background:(#[0-9a-f]{6})/g)].map(x => x[1]);
  assert.deepEqual(legenda, ["#14b8a6", "#7986cb"]);
  assert.equal(escuras(svg(html(), "chart-m")), 2, "hoje: só a barra do último dia (WhatsApp e E-mail)");
  assert.equal(escuras(svg(html(), "chart-d")), 2);
  m.run(`UI.dash.per = "7d"`);
  const mob = svg(html(), "chart-m");
  assert.equal(escuras(mob), 0, "7 dias no gráfico de 7 dias: nada a separar");
  assert.deepEqual([...new Set([...mob.matchAll(/<rect[^>]*fill="(#[0-9a-f]{6})"/g)].map(x => x[1]))].sort(), [...legenda].sort());
  assert.doesNotMatch(mob, /font-weight="700"/);
  assert.equal(escuras(svg(html(), "chart-d")), 14, "no de 14 dias, os 7 do período ficam destacados");
});

test("dados do gráfico em tabela: dia, WhatsApp, E-mail e total dos 14 dias", () => {
  const m = carregar();
  const html = m.run("viewDashboard()");
  const det = html.match(/<details class="dados" id="dados-graf"[^>]*>[\s\S]*?<\/details>/)[0];
  assert.match(det, /<summary id="dados-graf-s">Ver dados do gráfico<\/summary>/);
  assert.match(texto(det), /Casos recebidos por dia e canal, de 25\/09 a 08\/10/);
  const linhas = [...det.matchAll(/<tr><th scope="row">(\d\d\/\d\d)<\/th><td[^>]*>(\d+)<\/td><td[^>]*>(\d+)<\/td><td[^>]*>(\d+)<\/td><\/tr>/g)].map(x => [x[1], +x[2], +x[3], +x[4]]);
  const DAYS = JSON.parse(m.run("JSON.stringify(DAYS)"));
  assert.deepEqual(linhas, DAYS.map(d => [d[0], d[1], d[2], d[1] + d[2]]));
  assert.match(svg(html, "chart-d"), /aria-label="Casos recebidos por dia e canal, de 25\/09 a 08\/10; valores em Ver dados do gráfico"/);
});

test("a tabela aberta continua aberta depois do redesenho", () => {
  const m = carregar();
  assert.doesNotMatch(m.run("viewDashboard()").match(/<details[^>]*>/)[0], /\sopen/);
  m.run("UI.dash.dados = true");
  assert.match(m.run("viewDashboard()").match(/<details[^>]*>/)[0], /\sopen/);
});

test("prefers-reduced-motion desliga animações e transições", () => {
  const bloco = CSS.match(/@media \(prefers-reduced-motion:reduce\)\{([^}]*\})\}/);
  assert.ok(bloco, "há regra de movimento reduzido");
  assert.match(bloco[1], /animation:none!important/);
  assert.match(bloco[1], /transition:none!important/);
});

test("com movimento reduzido, Reproduzir mostra a conversa inteira sem atrasos", () => {
  const m = carregar();
  m.run(`window.matchMedia = q => ({ matches: /prefers-reduced-motion: reduce/.test(q) })`);
  m.run(`waPlay("A")`);
  const chat = m.els.get("#chat-A").innerHTML;
  const n = m.run(`waFlows().A.length`);
  assert.equal((chat.match(/<div class="(msg|sys|qr)/g) || []).length, n);
  assert.doesNotMatch(chat, /typing/);
  m.run(`window.matchMedia = q => ({ matches: false })`);
  m.run(`waPlay("B")`);
  assert.equal(m.els.get("#chat-B").innerHTML, "", "sem preferência, a reprodução começa vazia e anima");
});
