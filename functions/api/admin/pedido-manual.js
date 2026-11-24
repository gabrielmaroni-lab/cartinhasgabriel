import { J, need, loadItems, readCfg, savePedido, baixarEstoque, pixPayload, reservas, comReservas, upsertCliente, normTel, normCpf, linkMP } from "../../_lib/core.js";
// Pedido fechado fora do site (WhatsApp, balcão). Só para quem está logado no painel.
const s = (v, n = 200) => String(v || "").trim().slice(0, n);
const PG = { pix: "Pix", dinheiro: "Dinheiro", cartao: "Cartão", link: "Link de pagamento", outro: "Outro" };
export async function onRequestPost({ request, env }) {
  const [sess, err] = await need(request, env); if (err) return err;
  let b; try { b = await request.json() } catch (e) { return J({ erro: "Dados inválidos." }, 400) }
  const cfg = await readCfg(env);
  const items = comReservas(await loadItems(env, request), await reservas(env, cfg.reservaHoras));
  const linhas = []; let subtotal = 0;
  for (const l of (Array.isArray(b.itens) ? b.itens : []).slice(0, 100)) {
    const it = items.find(i => String(i.id) === String(l.id)); const q = Math.floor(Number(l.q));
    if (!it || !(q > 0)) continue;
    if (q > it.q) return J({ erro: `Só há ${it.q} de ${it.n} ${it.num || ""} livre${it.res ? ` (${it.res} reservada em outro pedido)` : ""}.` }, 409);
    const p = Number(l.p) >= 0 && l.p !== "" && l.p != null ? Math.round(Number(l.p) * 100) / 100 : it.p;
    linhas.push({ id: it.id, n: it.n, num: it.num || "", l: it.l || "", v: it.v || "", c: it.c || "", q, p }); subtotal += q * p;
  }
  if (!linhas.length) return J({ erro: "Adicione pelo menos um item." }, 400);
  const nome = s(b.nome, 80); if (!nome) return J({ erro: "Informe o nome do cliente." }, 400);
  const tel = normTel(b.telefone), cpf = normCpf(b.cpf);
  subtotal = Math.round(subtotal * 100) / 100;
  const desconto = Math.min(subtotal, Math.max(0, Math.round((Number(b.desconto) || 0) * 100) / 100));
  const frete = Math.max(0, Math.round((Number(b.frete) || 0) * 100) / 100);
  const total = Math.round((subtotal - desconto + frete) * 100) / 100;
  const metodo = PG[b.pagamento] ? b.pagamento : "outro";
  const status = ["aguardando", "pago", "preparacao", "enviado", "entregue"].includes(b.status) ? b.status : "aguardando";
  let entrega; const be = b.entrega || {};
  if (be.tipo === "envio") entrega = { tipo: "envio", servico: s(be.servico, 60) || "Envio", prazo: "", preco: frete, cep: s(be.cep, 9), cpf: cpf, rua: s(be.rua, 200), comp: s(be.comp, 80), bairro: s(be.bairro, 80), cidade: s(be.cidade, 80) };
  else { const r = Number(be.ponto) >= 0 ? (cfg.retiradas || []).filter(x => x.ativo !== false)[Number(be.ponto)] : null; entrega = r ? { tipo: "retirada", ponto: r.nome, endereco: r.endereco || "" } : { tipo: "retirada", ponto: "Combinado com o cliente", endereco: "" } }
  const d = new Date(Date.now() - 4 * 3600e3);
  const id = d.toISOString().slice(2, 10).replace(/-/g, "") + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  const agora = new Date().toISOString();
  const o = { id, em: agora, origem: "manual", status, pagamento: "manual_" + metodo, pagamentoTxt: PG[metodo], cliente: { nome, telefone: s(b.telefone, 20), cpf }, obs: s(b.obs, 500), itens: linhas, subtotal, desconto, cupom: desconto ? "manual" : "", frete, total, entrega, baixado: false,
    historico: [{ em: agora, status: "aguardando", por: sess.usuario + " (manual)" }] };
  if (status !== "aguardando") { o.historico.push({ em: agora, status, por: sess.usuario }); await baixarEstoque(env, request, o) }
  const out = { loja: (cfg.loja || {}).nome || "" };
  if (status === "aguardando" && (metodo === "link" || metodo === "cartao")) { try { const m = await linkMP(env, request, o, cfg); if (m) { o.mpPref = m.pref; o.mpLink = m.url } else out.avisoLink = "Mercado Pago não configurado: o link não foi gerado." } catch (e) { out.avisoLink = "Não deu para gerar o link do Mercado Pago agora." } }
  await savePedido(env, o);
  let cli = null; try { cli = await upsertCliente(env, { nome, telefone: tel, cpf, cep: entrega.cep, rua: entrega.rua, comp: entrega.comp, bairro: entrega.bairro, cidade: entrega.cidade }) } catch (e) { }
  const pix = (cfg.pagamentos || {}).pix || {};
  if (metodo === "pix" && status === "aguardando" && pix.chave) out.pix = { copiaecola: pixPayload(pix.chave, pix.nome, pix.cidade, total, id), chave: pix.chave, nome: pix.nome || "" };
  return J({ ...o, ...out, clienteId: cli && cli.id, reservaHoras: Number(cfg.reservaHoras) > 0 ? Number(cfg.reservaHoras) : 24 });
}
