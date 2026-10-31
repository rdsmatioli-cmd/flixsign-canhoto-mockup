/* Carrega o <script> do index.html num contexto vm com um DOM mínimo, para testar as regras do mockup com node --test.
   Sem dependências: cada chamada de carregar() devolve um mockup novo, com relógio próprio que só anda com avancar(). */
import { readFileSync } from "node:fs";
import vm from "node:vm";

const HTML = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const SRC = HTML.match(/<script>([\s\S]*?)<\/script>/)[1];

function elementoBase(sel, aoFocar) {
  const ouvintes = {};
  const classes = new Set();
  const attrs = new Map();
  const el = {
    sel, value: "", checked: false, disabled: false, indeterminate: false, innerHTML: "", textContent: "", dataset: {}, style: {}, scrollTop: 0, scrollHeight: 0, filhos: [],
    classList: { add: (...c) => c.forEach(x => classes.add(x)), remove: (...c) => c.forEach(x => classes.delete(x)), toggle: (c, f) => ((f ?? !classes.has(c)) ? classes.add(c) : classes.delete(c)), contains: c => classes.has(c) },
    addEventListener: (t, f) => { (ouvintes[t] ||= []).push(f); },
    disparar: (t, ev) => (ouvintes[t] || []).forEach(f => f(Object.assign({ target: el }, ev))),
    setAttribute: (k, v) => { attrs.set(k, String(v)); }, getAttribute: k => (attrs.has(k) ? attrs.get(k) : null), removeAttribute: k => { attrs.delete(k); }, hasAttribute: k => attrs.has(k),
    appendChild: c => { el.filhos.push(c); return c; }, remove() {}, focus() { if (aoFocar) aoFocar(el); }, click() {}, contains: () => false, insertAdjacentHTML() {}, setSelectionRange() {},
    querySelector: () => null, querySelectorAll: () => [], closest: () => null, matches: () => false,
  };
  return el;
}

export function carregar() {
  const els = new Map();
  const definidos = new Set();
  const timers = [];
  /* foco: cada focus() de elemento do mockup entra em focos (seletor) e vira o activeElement */
  const focos = [];
  const elemento = sel => elementoBase(sel, el => { focos.push(el.sel); document.activeElement = el; });
  /* o modal troca o conteúdo a cada diálogo: os campos do anterior somem, como no DOM real */
  const modal = elemento("#modal"); let modalHTML = "";
  Object.defineProperty(modal, "innerHTML", { get: () => modalHTML, set(v) { modalHTML = v; for (const k of [...els.keys()]) if (/^#m-|^input\[name=/.test(k)) els.delete(k); } });
  els.set("#modal", modal);
  const ouvintesDoc = {};
  const document = {
    activeElement: null, title: "", body: elemento("body"),
    querySelector(sel) {
      if (els.has(sel)) return els.get(sel);
      if (/:checked/.test(sel)) return null; // rádio/checkbox só existe se o teste marcar
      const e = elemento(sel); els.set(sel, e); return e;
    },
    querySelectorAll: () => [],
    createElement: t => elemento(t),
    addEventListener: (t, f) => { (ouvintesDoc[t] ||= []).push(f); },
  };
  const ctx = vm.createContext({
    document, window: { addEventListener() {}, scrollTo() {} }, location: { hash: "" }, CSS: { escape: s => String(s) }, navigator: {}, console,
    setTimeout: (f, ms) => { timers.push({ f, ms }); return timers.length; }, clearTimeout() {}, setInterval: () => 0, requestAnimationFrame: () => 0, cancelAnimationFrame() {},
  });
  vm.runInContext("(() => { const base = Date.now(); let d = 0; Date.now = () => base + d; globalThis.__avancar = ms => { d += ms; }; })();", ctx);
  vm.runInContext(SRC, ctx, { filename: "index.html" });
  const run = code => vm.runInContext(code, ctx);
  const api = {
    run, els, focos,
    /* avança o relógio do mockup em minutos */
    avancar: min => run(`__avancar(${min * 60000})`),
    /* define um campo do formulário do modal (valor, checked); para rádio marcado use o seletor com :checked */
    campo(sel, props) { const e = elemento(sel); Object.assign(e, props); els.set(sel, e); definidos.add(sel); return e; },
    limparCampos() { for (const k of definidos) els.delete(k); definidos.clear(); },
    /* confirma o modal aberto; devolve o retorno do callback (false = recusado) */
    confirmar() { const r = run("modalOk ? modalOk() : undefined"); if (r !== false) run("closeModal()"); return r; },
    /* simula clique num elemento com data-act (passa pela delegação do document) */
    clicar(dataset, extra) {
      const alvo = Object.assign(elemento("[data-act]"), { dataset }, extra || {});
      const ev = { target: { closest: s => (s === "[data-act]" ? alvo : null), matches: () => false }, stopPropagation() {}, preventDefault() {} };
      (ouvintesDoc.click || []).forEach(f => f(ev));
      return alvo;
    },
    /* dispara o listener de change/input da delegação (filtros com data-f) */
    filtro(path, valor, tag) {
      const alvo = { dataset: { f: path }, value: valor, tagName: tag || "SELECT" };
      (ouvintesDoc[tag === "INPUT" ? "input" : "change"] || []).forEach(f => f({ target: alvo }));
    },
    rodarTimers() { while (timers.length) timers.shift().f(); },
    toasts: () => (els.get("#toasts") || { filhos: [] }).filhos.map(t => t.innerHTML.replace(/<[^>]+>/g, "")),
    modal: () => (els.get("#modal") || {}).innerHTML || "",
  };
  return api;
}

/* texto de uma célula/elemento do HTML gerado: primeira ocorrência do padrão, sem tags */
export const texto = s => String(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
