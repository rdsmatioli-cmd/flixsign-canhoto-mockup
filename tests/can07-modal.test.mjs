/* CAN-07: diálogo contém o foco (resto da página inerte), rádios em fieldset/legend e erro de validação anunciado no campo */
import { test } from "node:test";
import assert from "node:assert/strict";
import { carregar } from "./carregar.mjs";

const attr = (m, sel, k) => (m.els.get(sel) || { getAttribute: () => null }).getAttribute(k);

test("Marcar como lançado: rádios da imagem num fieldset com legend e #m-err com role=alert", () => {
  const m = carregar();
  m.run(`dlgLancar(byId("K7Q2-61"))`);
  const html = m.modal();
  assert.match(html, /<fieldset[^>]*>\s*<legend[^>]*>Imagem anexada no NetFactor\?<\/legend>[\s\S]*name="m-img" value="1"[\s\S]*name="m-img" value="0"[\s\S]*<\/fieldset>/);
  assert.match(html, /<div class="err-msg" id="m-err" role="alert"><\/div>/);
  assert.match(html, /<h2 id="modal-t" tabindex="-1">/, "título focável por script, fora da ordem de Tab");
});

test("todos os diálogos anunciam o erro em #m-err com role=alert", () => {
  const m = carregar();
  for (const [fn, id] of [["dlgLancar", "K7Q2-61"], ["dlgCorrigir", "K7Q2-86"], ["dlgVincular", "K7Q2-63"], ["dlgDescartar", "K7Q2-86"], ["dlgDesfazer", "K7Q2-61"]]) {
    m.run(`${fn}(byId("${id}"))`);
    assert.match(m.modal(), /id="m-err" role="alert"/, fn);
    m.run("closeModal()");
  }
});

test("com o diálogo aberto o resto da página fica inerte; ao fechar, volta", () => {
  const m = carregar();
  m.run(`dlgLancar(byId("K7Q2-61"))`);
  assert.equal(m.els.get(".app").inert, true);
  m.run("closeModal()");
  assert.equal(m.els.get(".app").inert, false);
});

test("confirmar sem marcar: campo inválido, descrito pelo erro e com o foco", () => {
  const m = carregar();
  m.run(`dlgLancar(byId("K7Q2-61"))`);
  m.campo("#m-ok", { checked: false }); m.campo("input[name=m-img]:checked", { value: "1" }); m.campo("#m-obs", { value: "" });
  assert.equal(m.confirmar(), false);
  assert.match(m.els.get("#m-err").textContent, /Confirme que o canhoto foi lançado/);
  assert.equal(attr(m, "#m-ok", "aria-invalid"), "true");
  assert.equal(attr(m, "#m-ok", "aria-describedby"), "m-err");
  assert.equal(m.focos.at(-1), "#m-ok");
});

test("Corrigir NF: o foco vai para o campo que falhou e o campo anterior deixa de ser inválido", () => {
  const m = carregar();
  m.run(`dlgCorrigir(byId("K7Q2-86"))`);
  m.campo("#m-nf", { value: "abc" }); m.campo("#m-serie", { value: "3" }); m.campo("#m-chave", { value: "" }); m.campo("#m-just", { value: "" });
  assert.equal(m.confirmar(), false);
  assert.equal(attr(m, "#m-nf", "aria-invalid"), "true");
  assert.equal(m.focos.at(-1), "#m-nf");
  m.run(`document.querySelectorAll = s => /aria-invalid/.test(s) ? [document.querySelector("#m-nf")] : []`);
  m.campo("#m-nf", { value: "771251" }); m.campo("#m-serie", { value: "x" });
  m.els.get("#m-nf").setAttribute("aria-invalid", "true");
  assert.equal(m.confirmar(), false);
  assert.equal(attr(m, "#m-serie", "aria-invalid"), "true");
  assert.equal(attr(m, "#m-nf", "aria-invalid"), null);
  assert.equal(m.focos.at(-1), "#m-serie");
});

test("Vincular sem título escolhido: o grupo de títulos é marcado inválido e recebe o foco", () => {
  const m = carregar();
  m.run(`dlgVincular(byId("K7Q2-63"))`);
  assert.match(m.modal(), /id="m-pick"[^>]*role="radiogroup"/);
  m.campo("#m-just", { value: "conferido" });
  assert.equal(m.confirmar(), false);
  assert.equal(attr(m, "#m-pick", "aria-invalid"), "true");
  assert.equal(attr(m, "#m-pick", "aria-describedby"), "m-err");
  assert.equal(m.focos.at(-1), "#m-pick");
});

test("Descartar e Desfazer sem justificativa: foco na justificativa", () => {
  const m = carregar();
  m.run(`dlgDescartar(byId("K7Q2-86"))`);
  m.campo("#m-just", { value: "" });
  assert.equal(m.confirmar(), false);
  assert.equal(attr(m, "#m-just", "aria-invalid"), "true");
  assert.equal(m.focos.at(-1), "#m-just");
  m.limparCampos(); m.run("closeModal()");
  m.run(`(c => { c.estado = "CONCLUIDO"; })(byId("K7Q2-61"))`);
  m.run(`dlgDesfazer(byId("K7Q2-61"))`);
  m.campo("#m-just", { value: "lançado no título errado" }); m.campo("#m-ok", { checked: false });
  assert.equal(m.confirmar(), false);
  assert.equal(attr(m, "#m-ok", "aria-invalid"), "true");
  assert.equal(m.focos.at(-1), "#m-ok");
});
