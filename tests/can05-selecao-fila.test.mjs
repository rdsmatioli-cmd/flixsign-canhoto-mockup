/* CAN-05: "Selecionar todos" olha só as linhas visíveis e selecionáveis; ação em lote não alcança caso escondido pelo filtro */
import { test } from "node:test";
import assert from "node:assert/strict";
import { carregar, texto } from "./carregar.mjs";

const cabecalho = html => html.match(/<input type="checkbox" data-act="selAll"[^>]*>/)[0];
const selecionados = m => JSON.parse(m.run(`JSON.stringify([...UI.fila.sel].sort())`));
function naFila(m) { m.run(`location.hash = "#fila"`); return () => m.run("viewFila()"); }
function lancar(m, id) {
  m.run(`dlgLancar(byId("${id}"))`);
  m.campo("#m-ok", { checked: true }); m.campo("input[name=m-img]:checked", { value: "1" }); m.campo("#m-obs", { value: "" });
  assert.notEqual(m.confirmar(), false); m.limparCampos();
}

test("com linha concluída na lista, o cabeçalho marca e desmarca de verdade", () => {
  const m = carregar(); const fila = naFila(m);
  lancar(m, "K7Q2-61");
  m.clicar({ act: "selAll" }, { checked: true });
  assert.equal(selecionados(m).length, 11);
  assert.match(cabecalho(fila()), /\bchecked\b/);
  assert.doesNotMatch(cabecalho(fila()), /data-indet/);
  m.clicar({ act: "selAll" }, { checked: false });
  assert.deepEqual(selecionados(m), []);
  assert.doesNotMatch(cabecalho(fila()), /\bchecked\b/);
});

test("seleção parcial deixa o cabeçalho indeterminado", () => {
  const m = carregar(); const fila = naFila(m);
  m.clicar({ act: "sel", id: "K7Q2-91" }, { checked: true });
  const h = cabecalho(fila());
  assert.match(h, /data-indet="1"/);
  assert.doesNotMatch(h, /\bchecked\b/);
});

test("filtro tira da seleção o que saiu da lista e o lote age só sobre os visíveis", () => {
  const m = carregar(); const fila = naFila(m);
  m.clicar({ act: "selAll" }, { checked: true });
  assert.equal(selecionados(m).length, 12);
  m.filtro("fila.canal", "EMAIL");
  const html = fila();
  const visiveis = [...html.matchAll(/data-act="sel" data-id="([^"]+)"/g)].map(x => x[1]).sort();
  assert.equal(visiveis.length, 4);
  assert.deepEqual(selecionados(m), visiveis);
  assert.match(texto(html.match(/<div class="tbl-foot">[\s\S]*?<\/div>/)[0]), /^4 selecionado/);
  m.clicar({ act: "assumirLote" });
  assert.match(m.toasts().at(-1), /^4 caso\(s\) atribuído\(s\)/);
  const fora = JSON.parse(m.run(`JSON.stringify(CASES.filter(x => isFila(x) && x.canal === "WHATSAPP" && x.resp === ME).map(x => x.id))`));
  assert.deepEqual(fora, ["K7Q2-74"], "só o K7Q2-74 já era da Ana; nenhum caso escondido foi atribuído");
});

test("sem linha selecionável visível, o cabeçalho fica desabilitado", () => {
  const m = carregar(); const fila = naFila(m);
  m.filtro("fila.q", "nada-casa-com-isto", "INPUT");
  assert.match(cabecalho(fila()), /disabled/);
});
