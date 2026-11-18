import { J, getPedido } from "../_lib/core.js";
// Consulta pública mínima (sem dados pessoais), usada na volta do Mercado Pago.
export async function onRequestGet({ request, env }) {
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!/^[0-9]{6}-[A-Z0-9]{4}$/.test(id)) return J({ erro: "Pedido inválido" }, 400);
  const o = await getPedido(env, id); if (!o) return J({ erro: "Pedido não encontrado" }, 404);
  return J({ id: o.id, status: o.status, total: o.total });
}
