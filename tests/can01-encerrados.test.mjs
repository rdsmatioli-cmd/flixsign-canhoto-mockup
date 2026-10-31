/* CAN-01: caso desfeito não conta como lançado; Idade e SLA de pendência encerrada param no encerramento */
import { test } from "node:test";
import assert from "node:assert/strict";
import { carregar, texto } from "./carregar.mjs";

const lancadosHoje = html => +html.match(/Lançados hoje<\/div><div class="v num">(\d+)/)[1];
const funilLancados = html => +html.match(/Lançados<\/span><div><div class="fn-bar"[^>]*>(\d+)/)[1];
const kpiFila = html => texto(html.match(/Aguardando lançamento manual<\/div>[\s\S]*?<div class="d">([\s\S]*?)<\/div><\/div>/)[1]);
const linhaPend = (m, id) => { const h = m.run("viewPend()"); const i = h.indexOf(`<tr data-open="${id}">`); assert.ok(i >= 0, `linha ${id} ausente`); return h.slice(i, h.indexOf("</tr>", i)); };
const cel = (linha, rotulo) => texto(linha.match(new RegExp(`data-l="${rotulo}">([\\s\\S]*?)</td>`))[1]);

function lancar(m, id) {
  m.run(`dlgLancar(byId("${id}"))`);
  m.campo("#m-ok", { checked: true }); m.campo("input[name=m-img]:checked", { value: "1" }); m.campo("#m-obs", { value: "" });
  assert.notEqual(m.confirmar(), false); m.limparCampos();
}
function desfazer(m, id) {
  m.run(`dlgDesfazer(byId("${id}"))`);
  m.campo("#m-just", { value: "lançado no título errado" }); m.campo("#m-ok", { checked: true });
  assert.notEqual(m.confirmar(), false); m.limparCampos();
}

test("lançar soma 1 em 'Lançados hoje' e desfazer devolve o valor; o desfeito aparece à parte", () => {
  const m = carregar();
  assert.equal(lancadosHoje(m.run("viewFila()")), 27);
  lancar(m, "K7Q2-61");
  assert.equal(lancadosHoje(m.run("viewFila()")), 28);
  assert.equal(funilLancados(m.run("viewDashboard()")), 28);
  assert.match(kpiFila(m.run("viewDashboard()")), /1 lançado\(s\) agora/);
  desfazer(m, "K7Q2-61");
  const fila = m.run("viewFila()"), dash = m.run("viewDashboard()");
  assert.equal(lancadosHoje(fila), 27);
  assert.match(texto(fila.match(/Lançados hoje<\/div>[\s\S]*?<\/div><\/div>/)[0]), /1 desfeito/);
  assert.equal(funilLancados(dash), 27);
  assert.doesNotMatch(kpiFila(dash), /lançado\(s\) agora/);
  assert.match(kpiFila(dash), /1 desfeito/);
});

test("pendência resolvida nos dados (K7Q2-68): Idade fixa no encerramento e SLA sem prazo", () => {
  const m = carregar();
  let l = linhaPend(m, "K7Q2-68");
  assert.equal(cel(l, "Idade"), "1 min");
  assert.equal(cel(l, "SLA"), "—");
  m.avancar(180);
  l = linhaPend(m, "K7Q2-68");
  assert.equal(cel(l, "Idade"), "1 min");
});

test("Corrigir NF com título encontrado encerra a pendência e congela a Idade", () => {
  const m = carregar();
  m.run(`dlgCorrigir(byId("K7Q2-86"))`);
  m.campo("#m-nf", { value: "771251" }); m.campo("#m-serie", { value: "3" }); m.campo("#m-chave", { value: "" }); m.campo("#m-just", { value: "" });
  assert.notEqual(m.confirmar(), false);
  assert.equal(m.run(`byId("K7Q2-86").pst`), "RESOLVIDA");
  const antes = cel(linhaPend(m, "K7Q2-86"), "Idade");
  m.avancar(90);
  assert.equal(cel(linhaPend(m, "K7Q2-86"), "Idade"), antes);
  assert.equal(cel(linhaPend(m, "K7Q2-86"), "SLA"), "—");
});

test("Reprocessar com sucesso e Descartar também congelam a Idade", () => {
  const m = carregar();
  m.run(`doReprocessar(byId("K7Q2-90"))`); m.rodarTimers();
  assert.equal(m.run(`byId("K7Q2-90").pst`), "RESOLVIDA");
  m.run(`dlgDescartar(byId("K7Q2-55"))`);
  m.campo("#m-just", { value: "mídia perdida" }); m.campo("#m-mot", { value: "Outro" }); m.campo("#m-av", { checked: false });
  assert.notEqual(m.confirmar(), false);
  const a90 = cel(linhaPend(m, "K7Q2-90"), "Idade"), a55 = cel(linhaPend(m, "K7Q2-55"), "Idade");
  m.avancar(240);
  assert.equal(cel(linhaPend(m, "K7Q2-90"), "Idade"), a90);
  assert.equal(cel(linhaPend(m, "K7Q2-55"), "Idade"), a55);
});

test("pendência aberta continua envelhecendo", () => {
  const m = carregar();
  const antes = cel(linhaPend(m, "K7Q2-77"), "Idade");
  m.avancar(60);
  assert.notEqual(cel(linhaPend(m, "K7Q2-77"), "Idade"), antes);
});
