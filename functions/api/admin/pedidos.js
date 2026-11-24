import { J, need, listPedidos, getPedido, savePedido, baixarEstoque, devolverEstoque } from "../../_lib/core.js";
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
  if (typeof b.rastreio === "string") o.rastreio = b.rastreio.slice(0, 60);
  if (typeof b.nota === "string") o.nota = b.nota.slice(0, 1000);
  await savePedido(env, o);
  return J(o);
}
