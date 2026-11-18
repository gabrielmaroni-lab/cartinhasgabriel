import { J, readCfg, aplicarCupom } from "../_lib/core.js";
export async function onRequestPost({ request, env }) {
  let b = {}; try { b = await request.json() } catch (e) { }
  const r = aplicarCupom(await readCfg(env), String(b.codigo || "").slice(0, 40), Number(b.subtotal) || 0);
  return J(r, r.erro ? 400 : 200);
}
