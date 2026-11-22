import { J, readCfg, readSec, loadItems, cotarFrete, aplicarCupom, pixPayload, savePedido, reservas, comReservas, upsertCliente } from "../_lib/core.js";
const s = (v, n = 200) => String(v || "").trim().slice(0, n);
const brl = v => "R$ " + v.toFixed(2).replace(".", ",");
export async function onRequestPost({ request, env }) {
  if (!env.ESTOQUE) return J({ erro: "Loja sem banco configurado." }, 503);
  let b; try { b = await request.json() } catch (e) { return J({ erro: "Pedido inválido." }, 400) }
  const cfg = await readCfg(env), items = comReservas(await loadItems(env, request), await reservas(env, cfg.reservaHoras));
  // 1. Itens: confere estoque e usa o preço do servidor
  const linhas = []; let subtotal = 0;
  for (const l of (Array.isArray(b.itens) ? b.itens : []).slice(0, 100)) {
    const it = items.find(i => String(i.id) === String(l.id)); const q = Math.floor(Number(l.q));
    if (!it || !(q > 0)) continue;
    if (q > it.q) return J({ erro: `Só temos ${it.q} de ${it.n} ${it.num || ""}. Ajuste o carrinho.` }, 409);
    linhas.push({ id: it.id, n: it.n, num: it.num, l: it.l, v: it.v || "", c: it.c, q, p: it.p }); subtotal += q * it.p;
  }
  if (!linhas.length) return J({ erro: "Seu carrinho está vazio." }, 400);
  subtotal = Math.round(subtotal * 100) / 100;
  const nome = s(b.nome, 80); if (!nome) return J({ erro: "Informe seu nome." }, 400);
  // 2. Entrega
  const ent = b.entrega || {}; let entrega, frete = 0;
  if (ent.tipo === "envio") {
    const cep = s(ent.cep, 9).replace(/\D/g, "");
    const cot = await cotarFrete(env, cep, subtotal);
    const op = (cot.opcoes || []).find(o => o.nome === ent.servico);
    if (!op) return J({ erro: "Calcule o frete de novo e escolha uma opção." }, 400);
    frete = op.preco;
    entrega = { tipo: "envio", servico: op.nome, prazo: op.prazo, preco: op.preco, cep, cpf: s(ent.cpf, 14), rua: s(ent.rua), comp: s(ent.comp), bairro: s(ent.bairro, 80), cidade: s(ent.cidade, 80) };
    if (entrega.cpf.replace(/\D/g, "").length !== 11 || !entrega.rua || !entrega.bairro || !entrega.cidade) return J({ erro: "Preencha CPF e endereço completos." }, 400);
  } else {
    const r = (cfg.retiradas || []).filter(x => x.ativo !== false)[Number(ent.ponto)];
    if (!r) return J({ erro: "Escolha onde retirar." }, 400);
    entrega = { tipo: "retirada", ponto: r.nome, endereco: r.endereco };
  }
  // 3. Cupom
  const cp = aplicarCupom(cfg, s(b.cupom, 40), subtotal); if (cp.erro) return J({ erro: cp.erro }, 400);
  const total = Math.round((subtotal - cp.desconto + frete) * 100) / 100;
  // 4. Pagamento
  const pg = cfg.pagamentos, metodo = b.pagamento;
  if (!pg[metodo] || !pg[metodo].ativo) return J({ erro: "Forma de pagamento indisponível." }, 400);
  const d = new Date(Date.now() - 4 * 3600e3);
  const id = d.toISOString().slice(2, 10).replace(/-/g, "") + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  const o = { id, em: new Date().toISOString(), status: "aguardando", pagamento: metodo, cliente: { nome, telefone: s(b.telefone, 20) }, obs: s(b.obs, 500), itens: linhas, subtotal, desconto: cp.desconto, cupom: cp.codigo || "", frete, total, entrega, baixado: false, historico: [{ em: new Date().toISOString(), status: "aguardando" }] };
  const resumo = linhas.map(l => `• ${l.q}x ${l.n} ${l.num} ${l.l}${l.v ? " " + l.v : ""} (${l.c}) — ${brl(l.q * l.p)}`).join("\n");
  const rec = entrega.tipo === "envio" ? `Envio: ${entrega.servico} (${brl(frete)})\n${entrega.rua}${entrega.comp ? ", " + entrega.comp : ""} – ${entrega.bairro} – ${entrega.cidade}\nCEP ${entrega.cep} · CPF ${entrega.cpf}` : `Retirada: ${entrega.ponto}`;
  const pgTxt = { whatsapp: "Pix pelo WhatsApp", pix: "Pix (QR Code no site)", mp: "Mercado Pago" }[metodo];
  const msg = `Olá! Pedido ${id}\n\n${resumo}\n\n${cp.desconto ? `Cupom ${cp.codigo}: -${brl(cp.desconto)}\n` : ""}Total: ${brl(total)}\nPagamento: ${pgTxt}\nNome: ${nome}\n${rec}${o.obs ? "\nObs.: " + o.obs : ""}`;
  const out = { id, total, subtotal, desconto: cp.desconto, frete, whatsapp: "https://wa.me/" + String(cfg.loja.whatsapp).replace(/\D/g, "") + "?text=" + encodeURIComponent(msg) };
  if (metodo === "pix") {
    if (!pg.pix.chave) return J({ erro: "Pix não configurado." }, 400);
    out.pix = { copiaecola: pixPayload(pg.pix.chave, pg.pix.nome, pg.pix.cidade, total, id), chave: pg.pix.chave, nome: pg.pix.nome };
  }
  if (metodo === "mp") {
    const sec = await readSec(env); if (!sec.mercadopago) return J({ erro: "Mercado Pago não configurado." }, 400);
    const origin = new URL(request.url).origin;
    const its = linhas.map(l => ({ title: `${l.n} ${l.num} ${l.l}`.slice(0, 250), quantity: l.q, unit_price: l.p, currency_id: "BRL" }));
    if (frete) its.push({ title: "Frete " + entrega.servico, quantity: 1, unit_price: frete, currency_id: "BRL" });
    const body = { items: its, external_reference: id, payer: { name: nome }, back_urls: { success: origin + "/?pedido=" + id, failure: origin + "/?pedido=" + id, pending: origin + "/?pedido=" + id }, auto_return: "approved", notification_url: origin + "/api/mp-webhook", statement_descriptor: String(cfg.loja.nome).slice(0, 13) };
    if (cp.desconto) body.items = [{ title: "Pedido " + id + " (" + linhas.reduce((a, l) => a + l.q, 0) + " itens, cupom " + cp.codigo + ")", quantity: 1, unit_price: total, currency_id: "BRL" }];
    const r = await fetch("https://api.mercadopago.com/checkout/preferences", { method: "POST", headers: { Authorization: "Bearer " + sec.mercadopago, "Content-Type": "application/json", "X-Idempotency-Key": id }, body: JSON.stringify(body) });
    const dj = await r.json().catch(() => ({}));
    if (!r.ok || !dj.init_point) return J({ erro: "Mercado Pago recusou o pedido. Tente outra forma de pagamento." }, 502);
    out.mp = dj.init_point; o.mpPref = dj.id;
  }
  await savePedido(env, o);
  try { const E = o.entrega || {}; await upsertCliente(env, { nome, telefone: o.cliente.telefone, cpf: E.cpf, cep: E.cep, rua: E.rua, comp: E.comp, bairro: E.bairro, cidade: E.cidade }) } catch (e) { }
  return J(out);
}
