import { J, need, listPedidos, getPedido, savePedido, baixarEstoque, devolverEstoque, loadItems, saveItems, readCfg, reservas } from "../../_lib/core.js";
const STATUS = ["aguardando", "pago", "preparacao", "enviado", "entregue", "cancelado", "recusado", "devolvido"];
export async function onRequestGet({ request, env }) {
  const [s, err] = await need(request, env); if (err) return err;
  const id = new URL(request.url).searchParams.get("id");
  if (id) { const o = await getPedido(env, id); return o ? J(o) : J({ erro: "Não encontrado" }, 404) }
  return J({ pedidos: await listPedidos(env) });
}
export async function onRequestPut({ request, env }) {
  const [s, err] = await need(request, env); if (err) return err;
  let b = {}; try { b = await request.json() } catch (e) { }
  const o = await getPedido(env, b.id); if (!o) return J({ erro: "Pedido não encontrado" }, 404);
  if (b.status) {
    if (!STATUS.includes(b.status)) return J({ erro: "Status inválido" }, 400);
    if (["pago", "preparacao", "enviado", "entregue"].includes(b.status)) await baixarEstoque(env, request, o);
    if (["cancelado", "recusado", "devolvido"].includes(b.status)) await devolverEstoque(env, request, o);
    o.status = b.status; o.historico.push({ em: new Date().toISOString(), status: b.status, por: s.usuario });
  }
  let novosAdd = null;
  if (Array.isArray(b.add) && b.add.length) {
    if (!["aguardando", "pago", "preparacao"].includes(o.status)) return J({ erro: "Só dá para adicionar itens em pedido não pago, pago ou em preparação." }, 400);
    const cfg = await readCfg(env), items = await loadItems(env, request), r = await reservas(env, cfg.reservaHoras);
    if (o.status === "aguardando") for (const l of o.itens) r[l.id] = Math.max(0, (r[l.id] || 0) - l.q);
    const novos = [];
    for (const l of b.add.slice(0, 50)) {
      const it = items.find(i => String(i.id) === String(l.id)), q = Math.floor(Number(l.q));
      if (!it || !(q > 0)) continue;
      const usado = novos.filter(a => String(a.id) === String(it.id)).reduce((t, a) => t + a.q, 0), livre = it.q - (r[it.id] || 0) - usado;
      if (q > livre) return J({ erro: `Só há ${Math.max(0, livre)} de ${it.n} ${it.num || ""} livre.` }, 409);
      const p = l.p !== "" && l.p != null && Number(l.p) >= 0 ? Math.round(Number(l.p) * 100) / 100 : it.p;
      novos.push({ id: it.id, n: it.n, num: it.num || "", l: it.l || "", v: it.v || "", c: it.c || "", q, p });
    }
    if (!novos.length) return J({ erro: "Nada para adicionar." }, 400);
    for (const a of novos) { const ex = o.itens.find(x => String(x.id) === String(a.id) && x.p === a.p); if (ex) ex.q += a.q; else o.itens.push({ ...a }) }
    if (o.baixado) { for (const a of novos) { const it = items.find(i => String(i.id) === String(a.id)); if (it) it.q = Math.max(0, it.q - a.q) } await saveItems(env, items) }
    o.subtotal = Math.round(o.itens.reduce((t, l) => t + l.q * l.p, 0) * 100) / 100;
    o.desconto = Math.min(o.subtotal, o.desconto || 0);
    o.total = Math.round((o.subtotal - o.desconto + (o.frete || 0)) * 100) / 100;
    if (o.status === "aguardando" && (o.mpPref || o.mpLink)) { delete o.mpPref; delete o.mpLink; o.avisoLink = "O link de pagamento antigo não vale mais: o total mudou." }
    o.historico.push({ em: new Date().toISOString(), status: o.status, por: s.usuario, nota: "Itens adicionados: " + novos.map(a => a.q + "x " + a.n).join(", ") });
    novosAdd = novos;
  }
  if (typeof b.rastreio === "string") o.rastreio = b.rastreio.slice(0, 60);
  if (typeof b.nota === "string") o.nota = b.nota.slice(0, 1000);
  await savePedido(env, o);
  return J(novosAdd ? { ...o, adicionados: novosAdd } : o);
}
