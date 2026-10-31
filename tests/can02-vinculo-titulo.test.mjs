/* CAN-02: um título, um canhoto; título de outro cedente só com aviso; nada pré-selecionado no Vincular */
import { test } from "node:test";
import assert from "node:assert/strict";
import { carregar, texto } from "./carregar.mjs";

function abrirVincular(m, id) {
  m.run(`dlgVincular(byId("${id}"))`);
  const q = m.els.get("#m-q");
  return {
    buscar(v) { q.value = v; q.disparar("input", { target: { value: v } }); return m.els.get("#m-pick").innerHTML; },
    outros(on) { const cb = m.els.get("#m-outros"); cb.checked = on; cb.disparar("change", { target: cb }); return m.els.get("#m-pick").innerHTML; },
    confirmar(tituloId, just, outros) {
      if (tituloId) m.campo("input[name=m-t]:checked", { value: tituloId });
      m.campo("#m-just", { value: just || "" });
      if (outros != null) m.els.get("#m-outros").checked = outros;
      const r = m.confirmar(); m.limparCampos(); return r;
    },
    erro: () => m.els.get("#m-err").textContent,
  };
}
const idDaNF = (m, nf) => m.run(`IDX.find(t => t.nf === "${nf}").id`);
const linhaDoTitulo = (html, id) => { const i = html.indexOf(`value="${id}"`); assert.ok(i >= 0, `título ${id} fora da lista`); const a = html.lastIndexOf("<label", i); return html.slice(a, html.indexOf("</label>", i)); };
const corrigir = (m, id, nf, serie) => { m.run(`dlgCorrigir(byId("${id}"))`); m.campo("#m-nf", { value: nf }); m.campo("#m-serie", { value: serie }); m.campo("#m-chave", { value: "" }); m.campo("#m-just", { value: "" }); const r = m.confirmar(); m.limparCampos(); return r; };

test("Vincular lista só títulos do cedente do caso", () => {
  const m = carregar();
  const v = abrirVincular(m, "K7Q2-63"); // SERRA
  const html = v.buscar("458731"); // título da TARUMA
  assert.doesNotMatch(html, /NF 458731/);
  assert.match(texto(html), /Nenhum título encontrado para "458731"/);
  assert.ok([...v.buscar("").matchAll(/<b class="num">NF (\d+)/g)].every(x => ["220934", "220901", "220950", "220977"].includes(x[1])));
});

test("título que já tem canhoto aparece desabilitado e não pode ser vinculado", () => {
  const m = carregar();
  const v = abrirVincular(m, "K7Q2-63");
  v.buscar("458731");
  const html = v.outros(true);
  const id = idDaNF(m, "458731");
  const linha = linhaDoTitulo(html, id);
  assert.match(linha, /disabled/);
  assert.match(texto(linha), /já tem canhoto \(caso K7Q2-91\)/i);
  assert.equal(v.confirmar(id, "teste", true), false);
  assert.match(v.erro(), /K7Q2-91/);
  const c = JSON.parse(m.run(`JSON.stringify((c => ({ ced: c.ced, mot: c.mot, estado: c.estado }))(byId("K7Q2-63")))`));
  assert.deepEqual(c, { ced: "SERRA", mot: "TITULO_AMBIGUO", estado: "PENDENTE" });
  assert.deepEqual(JSON.parse(m.run(`JSON.stringify(CASES.filter(x => x.titulo && x.titulo.nf === "458731" && x.estado === "PENDENTE").map(x => x.id))`)), ["K7Q2-91"]);
});

test("título de outro cedente: só com a opção marcada, com aviso e evento próprio", () => {
  const m = carregar();
  const v = abrirVincular(m, "K7Q2-63");
  v.buscar("458712");
  const html = v.outros(true);
  const id = idDaNF(m, "458712");
  assert.match(texto(linhaDoTitulo(html, id)), /Outro cedente/);
  assert.match(texto(m.els.get("#m-aviso").innerHTML), /outro cedente/i);
  assert.equal(v.confirmar(id, "confirmado por telefone", false), false, "sem a opção marcada não vincula");
  assert.equal(m.run(`byId("K7Q2-63").ced`), "SERRA");
  assert.notEqual(v.confirmar(id, "confirmado por telefone", true), false);
  const ev = m.run(`byId("K7Q2-63").events.filter(e => e.tipo === "VINCULO_OUTRO_CEDENTE").map(e => e.d).join("|")`);
  assert.match(ev, /Metalúrgica Tarumã/);
  assert.equal(m.run(`byId("K7Q2-63").ced`), "TARUMA");
});

test("nenhum candidato vem pré-selecionado; o título negado pelo remetente é sinalizado", () => {
  const m = carregar();
  const v = abrirVincular(m, "K7Q2-83");
  const modal = m.modal();
  assert.doesNotMatch(modal, /name="m-t"[^>]*checked/);
  const negado = m.run(`byId("K7Q2-83").titulo.id`);
  assert.match(texto(linhaDoTitulo(modal, negado)), /respondeu NÃO/);
  assert.equal(v.confirmar(null, "x"), false);
  assert.match(v.erro(), /Selecione um título/);
});

test("Corrigir NF: segundo caso para o mesmo título encerra como TITULO_JA_COM_CANHOTO", () => {
  const m = carregar();
  assert.notEqual(corrigir(m, "K7Q2-86", "771251", "3"), false);
  assert.equal(m.run(`byId("K7Q2-86").estado`), "AGUARDANDO_CONFIRMACAO");
  assert.notEqual(corrigir(m, "K7Q2-88", "771251", "3"), false);
  const c = JSON.parse(m.run(`JSON.stringify((c => ({ estado: c.estado, mot: c.mot, dup: c.dupCode, det: c.detalhe, aberta: isOpenExc(c) }))(byId("K7Q2-88")))`));
  assert.equal(c.estado, "JA_REGISTRADO");
  assert.equal(c.mot, "DUPLICIDADE");
  assert.equal(c.dup, "TITULO_JA_COM_CANHOTO");
  assert.match(c.det, /K7Q2-86/);
  assert.equal(c.aberta, false);
  assert.match(m.run(`byId("K7Q2-88").events.map(e => e.tipo + ":" + e.d).join("|")`), /TITULO_JA_COM_CANHOTO:.*K7Q2-86.*\|MENSAGEM_ENVIADA:Template DUPLICIDADE/);
  assert.equal(m.run(`CASES.filter(x => x.titulo && x.titulo.nf === "771251" && x.estado === "AGUARDANDO_CONFIRMACAO").length`), 1);
});

test("Corrigir NF para título já na fila de lançamento também é duplicidade (mesma regra dos dados iniciais)", () => {
  const m = carregar();
  assert.notEqual(corrigir(m, "K7Q2-52", "458731", "1"), false);
  assert.equal(m.run(`byId("K7Q2-52").estado`), "JA_REGISTRADO");
  assert.match(m.run(`byId("K7Q2-52").detalhe`), /K7Q2-91 em PRONTO_LANCAMENTO_MANUAL/);
});

test("lista de títulos é região rotulada e focável (pode rolar só com títulos desabilitados)", () => {
  const m = carregar();
  m.run(`dlgVincular(byId("K7Q2-63"))`);
  assert.match(m.modal(), /<div class="pick" id="m-pick" tabindex="0" role="region" aria-label="Títulos encontrados">/);
});
