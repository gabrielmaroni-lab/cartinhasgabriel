// Biblioteca comum das Functions (não é rota).
export const enc = new TextEncoder();
export const b64u = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const J = (o, s = 200, h = {}) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...h } });
export const rnd = (n = 16) => b64u(crypto.getRandomValues(new Uint8Array(n)));
export async function hmac(key, data) { const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return b64u(await crypto.subtle.sign("HMAC", k, enc.encode(data))) }
export const eq = async (a, b) => (await hmac("cmp", String(a))) === (await hmac("cmp", String(b)));
export function cookie(req, n) { const c = req.headers.get("Cookie") || ""; const m = c.match(new RegExp("(?:^|; )" + n + "=([^;]+)")); return m ? m[1] : null }
export async function pbkdf2(pass, salt) {
  const k = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveBits"]);
  return b64u(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: 100000 }, k, 256));
}
export async function kvJson(env, k, d) { if (!env.ESTOQUE) return d; const v = await env.ESTOQUE.get(k, "json"); return v == null ? d : v }
export async function sessKey(env) {
  let k = await env.ESTOQUE.get("sess_key");
  if (!k) { k = rnd(32); await env.ESTOQUE.put("sess_key", k) }
  return k;
}
export const PAPEIS = { admin: "Administrador (tudo)", operador: "Operador (produtos e pedidos)" };
// Sessão: cookie adm = base64url(usuario).exp.assinatura
export async function getSession(request, env) {
  if (!env.ESTOQUE) return null;
  const t = cookie(request, "adm"); if (!t) return null;
  const [u64, exp, sig] = t.split("."); if (!u64 || !exp || !sig || Date.now() > +exp) return null;
  const key = await sessKey(env);
  if (sig !== await hmac(key, u64 + "." + exp)) return null;
  let usuario; try { usuario = decodeURIComponent(escape(atob(u64.replace(/-/g, "+").replace(/_/g, "/")))) } catch (e) { return null }
  const users = await kvJson(env, "users", []);
  const u = users.find(x => x.usuario === usuario);
  if (u) return { usuario, papel: u.papel, nome: u.nome || usuario };
  if (usuario === "admin" && env.ADMIN_PASSWORD) return { usuario, papel: "admin", nome: "Administrador" };
  return null;
}
export async function makeCookie(env, usuario) {
  const u64 = b64u(enc.encode(usuario)); const exp = String(Date.now() + 7 * 864e5);
  const sig = await hmac(await sessKey(env), u64 + "." + exp);
  return `adm=${u64}.${exp}.${sig}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`;
}
export async function need(request, env, papel) {
  const s = await getSession(request, env);
  if (!s) return [null, J({ erro: "Entre de novo no painel." }, 401)];
  if (papel === "admin" && s.papel !== "admin") return [null, J({ erro: "Só administradores podem fazer isso." }, 403)];
  return [s, null];
}
// Estoque: usa o mais recente entre o arquivo items.json publicado e o salvo no painel.
export async function loadItems(env, request) {
  let fileEm = 0, kvEm = 0, items = null;
  try { const r = await env.ASSETS.fetch(new URL("/items_em.txt", request.url)); if (r.ok) fileEm = Date.parse((await r.text()).trim()) || 0 } catch (e) { }
  if (env.ESTOQUE) { kvEm = Date.parse(await env.ESTOQUE.get("items_em") || "") || 0; if (kvEm >= fileEm) items = await env.ESTOQUE.get("items", "json") }
  if (!items) { const r = await env.ASSETS.fetch(new URL("/items.json", request.url)); items = r.ok ? await r.json() : [] }
  return items;
}
export async function saveItems(env, items) {
  const old = await env.ESTOQUE.get("items"); if (old) await env.ESTOQUE.put("items_anterior", old);
  await env.ESTOQUE.put("items", JSON.stringify(items)); await env.ESTOQUE.put("items_em", new Date().toISOString());
}
export const DEF_CFG = {
  loja: { nome: "Cartas do Gabriel", whatsapp: "5592981732192", rodape: "Estado das cartas: NM (quase perfeita) e SP (pouco jogada) · preços com base no menor anúncio NM da Liga Pokémon" },
  retiradas: [
    { nome: "CNT Computadores", endereco: "Av. São Jorge, 16, 1º andar, sala 4 · São Jorge", horario: "Seg a sex 9h–18h · sáb 8h–12h", ativo: true },
    { nome: "Mimiso Arena", endereco: "Beco São Pedro, 162 · Parque 10 de Novembro", horario: "Seg a sáb 9h–22h", ativo: true },
    { nome: "Mercadia Game Store", endereco: "R. Rio Jutaí, 90 · Vieiralves", horario: "Ter a sex 15h–22h · sáb 14h–21h", ativo: true }],
  envio: { ativo: true, provedor: "superfrete", cepOrigem: "69033120", pacote: { altura: 2, largura: 11, comprimento: 16, peso: 0.1 }, email: "", fixos: [{ nome: "Envio padrão", preco: 25, prazo: "7 a 12" }] },
  pagamentos: { whatsapp: { ativo: true }, pix: { ativo: false, chave: "", nome: "", cidade: "" }, mp: { ativo: false } },
  cupons: []
};
export async function readCfg(env) {
  const c = await kvJson(env, "cfg", {});
  if (typeof c.loja === "string") c.loja = { nome: c.loja };
  const o = { ...DEF_CFG, ...c };
  for (const k of ["loja", "envio", "pagamentos"]) o[k] = { ...DEF_CFG[k], ...(c[k] || {}) };
  o.envio.pacote = { ...DEF_CFG.envio.pacote, ...((c.envio || {}).pacote || {}) };
  for (const k of ["whatsapp", "pix", "mp"]) o.pagamentos[k] = { ...DEF_CFG.pagamentos[k], ...(((c.pagamentos || {})[k]) || {}) };
  return o;
}
export async function readSec(env) {
  const s = await kvJson(env, "sec", {});
  if (!s.superfrete && env.SUPERFRETE_TOKEN) s.superfrete = env.SUPERFRETE_TOKEN;
  return s;
}
// ---------- Frete ----------
export async function cotarFrete(env, cep, valor = 0) {
  const cfg = await readCfg(env), sec = await readSec(env), e = cfg.envio, p = e.pacote;
  if (!e.ativo) return { erro: "Envio desativado" };
  cep = String(cep || "").replace(/\D/g, ""); if (cep.length !== 8) return { erro: "CEP inválido" };
  const origem = String(e.cepOrigem || "").replace(/\D/g, "");
  const ok = arr => ({ opcoes: arr.filter(o => o.preco > 0).sort((a, b) => a.preco - b.preco) });
  try {
    if (e.provedor === "fixo") return ok((e.fixos || []).map(f => ({ nome: f.nome, preco: Number(f.preco), prazo: f.prazo })));
    if (e.provedor === "superfrete") {
      if (!sec.superfrete) return { erro: "Token da SuperFrete não configurado" };
      const r = await fetch("https://api.superfrete.com/api/v0/calculator", { method: "POST", headers: { Authorization: "Bearer " + sec.superfrete, "Content-Type": "application/json", Accept: "application/json", "User-Agent": "LojaCartas/1.0" },
        body: JSON.stringify({ from: { postal_code: origem }, to: { postal_code: cep }, services: "1,2,17", options: { own_hand: false, receipt: false, insurance_value: 0, use_insurance_value: false }, package: { height: p.altura, width: p.largura, length: p.comprimento, weight: p.peso } }) });
      const d = await r.json().catch(() => null); if (!Array.isArray(d)) return { erro: "SuperFrete não respondeu (" + r.status + ")" };
      return ok(d.filter(s => !s.error && !s.has_error && s.price).map(s => ({ nome: s.name, preco: Number(s.price), prazo: s.delivery_time })));
    }
    if (e.provedor === "melhorenvio") {
      if (!sec.melhorenvio) return { erro: "Token do Melhor Envio não configurado" };
      const r = await fetch("https://www.melhorenvio.com.br/api/v2/me/shipment/calculate", { method: "POST", headers: { Authorization: "Bearer " + sec.melhorenvio, "Content-Type": "application/json", Accept: "application/json", "User-Agent": "LojaCartas (" + (e.email || "contato@loja.com") + ")" },
        body: JSON.stringify({ from: { postal_code: origem }, to: { postal_code: cep }, package: { height: p.altura, width: p.largura, length: p.comprimento, weight: p.peso }, options: { insurance_value: valor, receipt: false, own_hand: false } }) });
      const d = await r.json().catch(() => null); if (!Array.isArray(d)) return { erro: "Melhor Envio não respondeu (" + r.status + ")" };
      return ok(d.filter(s => !s.error && s.price).map(s => ({ nome: ((s.company && s.company.name) ? s.company.name + " " : "") + s.name, preco: Number(s.custom_price || s.price), prazo: s.custom_delivery_time || s.delivery_time })));
    }
    if (e.provedor === "frenet") {
      if (!sec.frenet) return { erro: "Token da Frenet não configurado" };
      const r = await fetch("https://api.frenet.com.br/shipping/quote", { method: "POST", headers: { token: sec.frenet, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ SellerCEP: origem, RecipientCEP: cep, ShipmentInvoiceValue: valor || 1, RecipientCountry: "BR", ShippingItemArray: [{ Height: p.altura, Length: p.comprimento, Width: p.largura, Weight: p.peso, Quantity: 1 }] }) });
      const d = await r.json().catch(() => null); const a = d && d.ShippingSevicesArray; if (!Array.isArray(a)) return { erro: "Frenet não respondeu (" + r.status + ")" };
      return ok(a.filter(s => !s.Error && s.ShippingPrice).map(s => ({ nome: (s.Carrier ? s.Carrier + " " : "") + s.ServiceDescription, preco: Number(String(s.ShippingPrice).replace(",", ".")), prazo: s.DeliveryTime })));
    }
    return { erro: "Provedor de frete desconhecido" };
  } catch (err) { return { erro: "Falha ao consultar o frete" } }
}
// ---------- Pix estático (BR Code) ----------
function crc16(s) { let c = 0xFFFF; for (let i = 0; i < s.length; i++) { c ^= s.charCodeAt(i) << 8; for (let j = 0; j < 8; j++) c = (c & 0x8000) ? ((c << 1) ^ 0x1021) & 0xFFFF : (c << 1) & 0xFFFF } return c.toString(16).toUpperCase().padStart(4, "0") }
const tlv = (id, v) => id + String(v.length).padStart(2, "0") + v;
const ascii = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 .@+\-_]/g, "").trim();
export function pixPayload(chave, nome, cidade, valor, txid) {
  const mai = tlv("00", "br.gov.bcb.pix") + tlv("01", String(chave).trim());
  let p = tlv("00", "01") + tlv("26", mai) + tlv("52", "0000") + tlv("53", "986") + tlv("54", valor.toFixed(2)) + tlv("58", "BR") + tlv("59", ascii(nome).slice(0, 25) || "LOJA") + tlv("60", ascii(cidade).slice(0, 15) || "BRASIL") + tlv("62", tlv("05", ascii(txid).replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***"));
  p += "6304"; return p + crc16(p);
}
// ---------- Pedidos ----------
export async function listPedidos(env) { return await kvJson(env, "pedidos", []) }
export async function savePedido(env, o) {
  await env.ESTOQUE.put("o:" + o.id, JSON.stringify(o));
  const idx = await listPedidos(env); const i = idx.findIndex(x => x.id === o.id);
  const resumo = { id: o.id, em: o.em, nome: o.cliente.nome, total: o.total, status: o.status, pagamento: o.pagamento };
  if (i >= 0) idx[i] = resumo; else idx.unshift(resumo);
  await env.ESTOQUE.put("pedidos", JSON.stringify(idx.slice(0, 1000)));
}
export async function getPedido(env, id) { return await kvJson(env, "o:" + id, null) }
// Dá baixa no estoque uma única vez quando o pedido vira "pago".
export async function baixarEstoque(env, request, o) {
  if (o.baixado) return o;
  const items = await loadItems(env, request);
  for (const l of o.itens) { const it = items.find(i => String(i.id) === String(l.id)); if (it) it.q = Math.max(0, it.q - l.q) }
  await saveItems(env, items); o.baixado = true; return o;
}
export async function devolverEstoque(env, request, o) {
  if (!o.baixado) return o;
  const items = await loadItems(env, request);
  for (const l of o.itens) { const it = items.find(i => String(i.id) === String(l.id)); if (it) it.q += l.q }
  await saveItems(env, items); o.baixado = false; return o;
}
export function aplicarCupom(cfg, codigo, subtotal) {
  if (!codigo) return { desconto: 0 };
  const c = (cfg.cupons || []).find(x => x.ativo !== false && String(x.codigo).toUpperCase() === String(codigo).trim().toUpperCase());
  if (!c) return { erro: "Cupom inválido" };
  if (c.validade && Date.now() > Date.parse(c.validade + "T23:59:59-04:00")) return { erro: "Cupom vencido" };
  if (c.minimo && subtotal < Number(c.minimo)) return { erro: "Cupom válido para compras a partir de R$ " + Number(c.minimo).toFixed(2).replace(".", ",") };
  let d = c.tipo === "valor" ? Number(c.valor) : subtotal * Number(c.valor) / 100;
  d = Math.min(subtotal, Math.round(d * 100) / 100);
  return { desconto: d, codigo: c.codigo, descricao: c.tipo === "valor" ? "R$ " + Number(c.valor).toFixed(2).replace(".", ",") + " de desconto" : c.valor + "% de desconto" };
}
