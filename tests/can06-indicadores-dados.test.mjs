/* CAN-06: indicadores da Visão geral coerentes entre si e dados de exemplo inequivocamente fictícios */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { carregar, texto } from "./carregar.mjs";

const somaDias = (m, n) => m.run(`DAYS.slice(-${n}).reduce((a, d) => a + d[1] + d[2], 0)`);
const cardCedente = html => html.slice(html.indexOf("<h2>Por cedente</h2>"), html.indexOf("</table>", html.indexOf("<h2>Por cedente</h2>")));
const kpi1 = html => texto(html.match(/<div class="card kpi accent">([\s\S]*?)<\/div><\/div>/)[1]);

test("Por cedente: recebidos somam o total do gráfico no período rotulado e Exceções dizem que são as abertas agora", () => {
  const m = carregar();
  const card = cardCedente(m.run("viewDashboard()"));
  const soma = [...card.matchAll(/data-l="Recebidos">(\d+)</g)].reduce((a, x) => a + +x[1], 0);
  assert.equal(soma, somaDias(m, 7));
  const [ini, fim] = m.run(`[DAYS.at(-7)[0], DAYS.at(-1)[0]].join("|")`).split("|");
  assert.match(texto(card), new RegExp(`${ini} a ${fim}`));
  assert.match(texto(card), /abertas agora/i);
});

test("seletor de período: Hoje e 7 dias mudam os recebidos a partir de DAYS; 30 dias fica desabilitado", () => {
  const m = carregar();
  let html = m.run("viewDashboard()");
  assert.match(html, /<option value="30d"[^>]*disabled/);
  assert.match(kpi1(html), new RegExp(`^Casos recebidos hoje ${somaDias(m, 1)}\\b`));
  m.filtro("dash.per", "7d");
  html = m.run("viewDashboard()");
  const w = m.run(`DAYS.slice(-7).reduce((a, d) => a + d[1], 0)`), e = m.run(`DAYS.slice(-7).reduce((a, d) => a + d[2], 0)`);
  assert.match(kpi1(html), new RegExp(`${somaDias(m, 7)} WhatsApp ${w} · E-mail ${e}$`));
  assert.match(html, /<option value="7d" selected/);
  m.filtro("dash.per", "hoje");
  assert.match(kpi1(m.run("viewDashboard()")), new RegExp(`^Casos recebidos hoje ${somaDias(m, 1)}\\b`));
});

test("K7Q2-90: 'próximo às' sai de nextTry e acompanha o relógio, com cada tentativa no histórico", () => {
  const m = carregar();
  m.run(`location.hash = "#pendencias"`);
  const linha = () => { m.run("render()"); const h = m.els.get("#view").innerHTML; const i = h.indexOf('<tr data-open="K7Q2-90">'); return texto(h.slice(i, h.indexOf("</tr>", i))); };
  const ultima = () => m.run(`fHM(byId("K7Q2-90").events.filter(e => e.tipo === "PENDENCIA_REPROCESSADA").at(-1).t)`);
  assert.equal(ultima(), "16:35");
  assert.match(linha(), /a cada 15 min \(próximo às 16:50\)/);
  m.avancar(20); // 17:00
  assert.match(linha(), /\(próximo às 17:05\)/);
  assert.equal(ultima(), "16:50");
  m.avancar(30); // 17:30
  assert.match(linha(), /\(próximo às 17:35\)/);
  assert.equal(m.run(`byId("K7Q2-90").events.filter(e => e.tipo === "PENDENCIA_REPROCESSADA").length`), 4);
});

test("K7Q2-55 registra as três tentativas de download", () => {
  const m = carregar();
  const d = m.run(`byId("K7Q2-55").events.filter(e => e.tipo === "MIDIA_REJEITADA").map(e => e.d).join("|")`);
  assert.match(d, /tentativa 1 de 3\).*\|.*tentativa 2 de 3\).*\|.*tentativa 3 de 3\)/);
});

test("remetentes com telefone e domínio inequivocamente fictícios", () => {
  const m = carregar();
  const ids = JSON.parse(m.run(`JSON.stringify(Object.values(REM).map(r => r.id))`));
  for (const id of ids) {
    if (id.includes("@")) assert.match(id, /\.exemplo$/, id);
    else assert.match(id, /^\+55 \d\d 90000-\d{4}$/, id);
  }
  const fonte = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.doesNotMatch(fonte, /\+55 \d\d 9[1-9]\d{3}-\d{4}/);
  assert.doesNotMatch(fonte, /-exemplo\.com\.br/);
});
