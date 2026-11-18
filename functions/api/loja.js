import { J, loadItems, readCfg } from "../_lib/core.js";
export async function onRequestGet({ env, request }) {
  const items = await loadItems(env, request), cfg = await readCfg(env);
  const pub = { ...cfg }; delete pub.cupons;
  pub.temCupom = (cfg.cupons || []).some(c => c.ativo !== false);
  return J({ items, cfg: pub, kv: !!env.ESTOQUE });
}
