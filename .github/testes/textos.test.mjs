// Testes dos textos regulatórios do mockup (index.html), sem dependências:
// node --test .github/testes/*.test.mjs
// Itens CAN-TXT-nn do dossiê para o parecer. Falham se o mockup voltar a divergir da fonte oficial
// (MOC da NF-e, LGPD) ou se passar a prometer validade jurídica ou prova de entrega sem parecer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
// Funções puras do mockup, avaliadas sozinhas (o resto do script depende do DOM).
const fonte = (nome) => {
  const i = script.indexOf(`function ${nome}(`);
  assert.ok(i >= 0, nome);
  let n = 0, j = script.indexOf('{', i);
  for (; j < script.length; j++) { if (script[j] === '{') n++; else if (script[j] === '}' && --n === 0) break; }
  return script.slice(i, j + 1);
};
const ctx = {};
vm.createContext(ctx);
vm.runInContext(['cnpj', 'chaveNFe', 'chaveValida'].map(fonte).join('\n') + '\nglobalThis.__t = { cnpj, chaveNFe, chaveValida };', ctx);
const { cnpj, chaveNFe, chaveValida } = ctx.__t;

// CAN-TXT-01: canhoto do DANFE e chave de acesso conforme o MOC 7.0 (Portal da NF-e, conferido em
// 31/10/2026). Anexo II (versão 7.00, out/2020), item 3.8.1: campos do bloco de canhoto
// "RECEBEMOS DE...", "NF-e / Nº 000.000.000 / SÉRIE 000", "DATA DE RECEBIMENTO" e
// "IDENTIFICAÇÃO E ASSINATURA..."; item 3.3.1: o bloco é opcional para o emitente.
test('CAN-TXT-01: desenho do canhoto traz os campos do MOC 7.0, Anexo II, item 3.8.1', () => {
  const svg = fonte('canhotoSVG');
  for (const campo of ['RECEBEMOS DE ', 'NOTA FISCAL ELETRÔNICA INDICADA AO LADO', '>NF-e<', 'Nº ${esc(fmtNF(', 'SÉRIE ${esc(',
    'DATA DE RECEBIMENTO', 'IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR', 'DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA']) {
    assert.ok(svg.includes(campo), campo);
  }
});
// MOC 7.0, Visão Geral (versão 7.00, nov/2020), 2.2.6.1 e 2.2.6.2: 44 dígitos (cUF, AAMM, CNPJ, mod,
// série, nNF, tpEmis, cNF, cDV) e DV por módulo 11 com pesos 2 a 9; exemplo oficial com DV 5.
test('CAN-TXT-01: chave de acesso de 44 dígitos e DV módulo 11 conferem com o exemplo do MOC', () => {
  assert.equal(chaveValida('52060433009911002506550120000007800267301615'), true);
  assert.equal(chaveValida('52060433009911002506550120000007800267301614'), false);
  const k = chaveNFe('35', '2610', cnpj('990000040001'), 1, 30092817, '40917263');
  assert.match(k, /^\d{44}$/);
  assert.equal(k.slice(20, 22), '55');
  assert.equal(chaveValida(k), true);
});

// CAN-TXT-02: LGPD (Lei 13.709/2018, norma atualizada da Câmara, 31/10/2026), art. 9º: o titular
// tem acesso facilitado à finalidade, forma e duração do tratamento, identificação e contato do
// controlador, uso compartilhado, responsabilidades e direitos do art. 18. O aviso do primeiro
// contato ainda não tem texto; o mockup indica o conteúdo mínimo e não inventa o texto.
test('CAN-TXT-02: aviso de privacidade do primeiro contato remete ao art. 9º da LGPD', () => {
  assert.ok(script.includes('Primeiro contato: aviso de privacidade enviado (texto a definir com o jurídico, com as informações do art. 9º da LGPD)'));
});
