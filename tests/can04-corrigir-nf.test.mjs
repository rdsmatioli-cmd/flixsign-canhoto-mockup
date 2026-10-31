/* CAN-04: Corrigir NF valida série, NF sem zeros à esquerda e a chave de acesso (DV, UF, modelo 55, CNPJ, NF/série e cedente) */
import { test } from "node:test";
import assert from "node:assert/strict";
import { carregar } from "./carregar.mjs";

const MOC = "52060433009911002506550120000007800267301615"; // exemplo do MOC da NF-e: DV 5, CNPJ 33.009.911/0025-06
const CHAVE_TARUMA_458731 = "35261099000001000101550010004587311123456783"; // NF 458731, série 1, CNPJ da Tarumã
/* troca um trecho da chave e recalcula o DV, para isolar a regra testada */
const comDV = (m, base43) => m.run(`(b => b + dvChave(b))("${base43}")`);
const trocar = (k, ini, txt) => k.slice(0, ini) + txt + k.slice(ini + txt.length, 43);

function corrigir(m, id, nf, serie, chave) {
  m.run(`dlgCorrigir(byId("${id}"))`);
  m.campo("#m-nf", { value: nf }); m.campo("#m-serie", { value: serie }); m.campo("#m-chave", { value: chave || "" }); m.campo("#m-just", { value: "" });
  const r = m.confirmar(); const erro = (m.els.get("#m-err") || {}).textContent || ""; m.limparCampos();
  return { aceito: r !== false, erro };
}
const estado = (m, id) => JSON.parse(m.run(`JSON.stringify((c => ({ nf: c.nf, serie: c.serie, chave: c.chave, estado: c.estado, mot: c.mot, titulo: c.titulo && c.titulo.id }))(byId("${id}")))`));

test("chave do MOC passa; DV, UF, modelo e CNPJ errados têm mensagem própria", () => {
  const m = carregar();
  assert.equal(m.run(`chaveProblema("${MOC}")`), null);
  assert.equal(m.run(`chaveValida("${MOC}")`), true);
  assert.match(m.run(`chaveProblema("${MOC.slice(0, 43)}4")`), /dígito verificador/);
  assert.match(m.run(`chaveProblema("${comDV(m, trocar(MOC, 0, "99"))}")`), /UF/);
  assert.match(m.run(`chaveProblema("${comDV(m, trocar(MOC, 20, "65"))}")`), /modelo 65/);
  assert.match(m.run(`chaveProblema("${comDV(m, trocar(MOC, 18, "07"))}")`), /CNPJ/);
  assert.match(m.run(`chaveProblema("123")`), /44 dígitos/);
});

test("série vazia ou com letras é recusada", () => {
  const m = carregar();
  let r = corrigir(m, "K7Q2-86", "771251", "abc");
  assert.equal(r.aceito, false); assert.match(r.erro, /Série/);
  r = corrigir(m, "K7Q2-77", "30092855", "");
  assert.equal(r.aceito, false); assert.match(r.erro, /Série/);
  assert.equal(estado(m, "K7Q2-86").estado, "PENDENTE");
  assert.equal(estado(m, "K7Q2-77").nf, null);
});

test("chave de outra NF ou de outro emitente é recusada", () => {
  const m = carregar();
  let r = corrigir(m, "K7Q2-86", "771251", "3", CHAVE_TARUMA_458731);
  assert.equal(r.aceito, false); assert.match(r.erro, /NF 458731, série 1/);
  r = corrigir(m, "K7Q2-86", "458731", "1", CHAVE_TARUMA_458731);
  assert.equal(r.aceito, false); assert.match(r.erro, /outro emitente/);
  assert.equal(estado(m, "K7Q2-86").chave, null);
});

test("chave coerente com NF, série e cedente é aceita e gravada", () => {
  const m = carregar();
  const k = m.run(`chaveNFe("35", "2610", CED.HORIZ.cnpj, 3, 771251, "12345678")`);
  const r = corrigir(m, "K7Q2-86", "771251", "003", k.replace(/(\d{4})/g, "$1 "));
  assert.equal(r.aceito, true, r.erro);
  assert.deepEqual(estado(m, "K7Q2-86"), { nf: "771251", serie: "3", chave: k, estado: "AGUARDANDO_CONFIRMACAO", mot: "FOTO_ILEGIVEL", titulo: m.run(`IDX.find(t => t.nf === "771251").id`) });
});

test("NF e série com zeros à esquerda acham o título e são gravadas sem os zeros", () => {
  const m = carregar();
  const r = corrigir(m, "K7Q2-70", "001185237", "02");
  assert.equal(r.aceito, true, r.erro);
  const e = estado(m, "K7Q2-70");
  assert.equal(e.nf, "1185237"); assert.equal(e.serie, "2");
  assert.equal(e.estado, "AGUARDANDO_CONFIRMACAO");
  assert.equal(e.titulo, m.run(`IDX.find(t => t.nf === "1185237").id`));
});

test("NF zero é recusada", () => {
  const m = carregar();
  const r = corrigir(m, "K7Q2-70", "000", "2");
  assert.equal(r.aceito, false); assert.match(r.erro, /NF/);
});
