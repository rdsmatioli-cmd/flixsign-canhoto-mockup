/* CAN-03: busca do "Vincular manualmente" (normalização, mensagem vazia, corte em 8, seleção mantida) */
import { test } from "node:test";
import assert from "node:assert/strict";
import { carregar, texto } from "./carregar.mjs";

/* abre o diálogo, digita a consulta e devolve o HTML da lista */
function abrir(m, id) { m.run(`dlgVincular(byId("${id}"))`); return q => { const e = m.els.get("#m-q"); e.value = q; e.disparar("input", { target: { value: q } }); return m.els.get("#m-pick").innerHTML; }; }
const nfsDe = html => [...html.matchAll(/<b class="num">NF (\d+)<\/b>/g)].map(x => x[1]);

test("busca acha sacados com 'r', sem diferenciar acento e caixa", () => {
  const m = carregar();
  const buscar = abrir(m, "K7Q2-52");
  assert.ok(nfsDe(buscar("Ferragens")).includes("458799"));
  assert.ok(nfsDe(buscar("ferragens ponto")).includes("458799"));
  assert.ok(nfsDe(buscar("industria mecanica")).includes("458744"));
  assert.deepEqual(nfsDe(buscar("458731")), ["458731"]);
  const b63 = abrir(m, "K7Q2-63");
  assert.ok(nfsDe(b63("fio de ouro")).includes("220950"));
  assert.ok(nfsDe(b63("Fio de Ouro")).includes("220950"));
});

test("busca por valor aceita R$ como prefixo e ponto de milhar", () => {
  const m = carregar();
  const b = abrir(m, "K7Q2-63");
  for (const q of ["R$ 4.925", "r$4.925,00", "4925", "4.925,00"]) assert.deepEqual(nfsDe(b(q)), ["220950", "220950"], q);
});

test("sem resultado: mensagem diz que a busca não casou, sem afirmar que o índice está vazio", () => {
  const m = carregar();
  const html = abrir(m, "K7Q2-52")("zzzz");
  assert.match(texto(html), /Nenhum título encontrado para "zzzz"/);
  assert.doesNotMatch(texto(html), /Nenhum título no índice/);
});

test("mais de 8 resultados: avisa quantos ficaram de fora", () => {
  const m = carregar();
  abrir(m, "K7Q2-52")("ltda");
  const cb = m.els.get("#m-outros"); cb.checked = true; cb.disparar("change", { target: cb }); // inclui os outros cedentes (CAN-02)
  const html = m.els.get("#m-pick").innerHTML;
  const total = m.run(`IDX.filter(t => /ltda/i.test(t.sac)).length`);
  assert.equal(nfsDe(html).length, 8);
  assert.match(texto(html), new RegExp(`mais ${total - 8} títulos?: refine a busca`, "i"));
});

test("digitar mantém o título escolhido, mesmo quando ele sai do resultado", () => {
  const m = carregar();
  const b = abrir(m, "K7Q2-52");
  b("4587");
  const id = m.run(`IDX.find(t => t.nf === "458712").id`); // título sem canhoto
  m.els.get("#m-pick").disparar("change", { target: { name: "m-t", value: id } });
  assert.match(b("45871"), new RegExp(`value="${id}" checked`));
  const fora = b("458731");
  assert.match(fora, new RegExp(`value="${id}" checked`));
  assert.ok(nfsDe(fora).includes("458731"));
});
