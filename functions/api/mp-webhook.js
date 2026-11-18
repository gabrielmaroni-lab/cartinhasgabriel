import { J, readSec, getPedido, savePedido, baixarEstoque, devolverEstoque } from "../_lib/core.js";
// O Mercado Pago avisa aqui; conferimos o pagamento direto na API dele (não confiamos no aviso).
export async function onRequest({ request, env }) {
  const u = new URL(request.url); let b = {}; try { b = await request.json() } catch (e) { }
  const tipo = u.searchParams.get("type") || u.searchParams.get("topic") || b.type || b.topic;
  const pid = u.searchParams.get("data.id") || u.searchParams.get("id") || (b.data && b.data.id);
  if (tipo !== "payment" || !pid || !/^\d+$/.test(String(pid))) return J({ ok: true });
  const sec = await readSec(env); if (!sec.mercadopago) return J({ ok: true });
  const r = await fetch("https://api.mercadopago.com/v1/payments/" + pid, { headers: { Authorization: "Bearer " + sec.mercadopago } });
  if (!r.ok) return J({ ok: true });
  const p = await r.json(); const o = await getPedido(env, p.external_reference); if (!o) return J({ ok: true });
  if (Math.abs(Number(p.transaction_amount) - o.total) > 0.05) { o.alerta = "Valor pago diferente do total"; await savePedido(env, o); return J({ ok: true }) }
  const map = { approved: "pago", rejected: "recusado", cancelled: "cancelado", refunded: "devolvido", in_process: "aguardando", pending: "aguardando" };
  const st = map[p.status] || o.status;
  if (st !== o.status) {
    o.status = st; o.mpPagamento = String(pid); o.historico.push({ em: new Date().toISOString(), status: st, por: "Mercado Pago" });
    if (st === "pago") await baixarEstoque(env, request, o);
    if (["cancelado", "devolvido", "recusado"].includes(st)) await devolverEstoque(env, request, o);
    await savePedido(env, o);
  }
  return J({ ok: true });
}
