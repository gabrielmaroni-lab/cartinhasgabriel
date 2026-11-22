import { J, loadItems, readCfg, reservas, comReservas, getSession } from "../_lib/core.js";
export async function onRequestGet({ env, request }) {
  const cfg = await readCfg(env);
  let items = await loadItems(env, request);
  // O painel (?todos=1, logado) recebe o estoque cheio; a vitrine desconta as cartas reservadas em pedidos aguardando pagamento.
  const todos = new URL(request.url).searchParams.get("todos") === "1" && await getSession(request, env);
  if (env.ESTOQUE && !todos) items = comReservas(items, await reservas(env, cfg.reservaHoras));
  const pub = { ...cfg }; delete pub.cupons;
  pub.temCupom = (cfg.cupons || []).some(c => c.ativo !== false);
  return J({ items, cfg: pub, kv: !!env.ESTOQUE });
}
