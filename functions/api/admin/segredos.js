import { J, need, kvJson } from "../../_lib/core.js";
const CAMPOS = ["superfrete", "melhorenvio", "frenet", "mercadopago"];
const mask = v => v ? "•••• " + String(v).slice(-4) : "";
export async function onRequestGet({ request, env }) {
  const [s, err] = await need(request, env, "admin"); if (err) return err;
  const sec = await kvJson(env, "sec", {}); const o = {};
  for (const c of CAMPOS) o[c] = mask(sec[c] || (c === "superfrete" ? env.SUPERFRETE_TOKEN : ""));
  return J(o);
}
export async function onRequestPut({ request, env }) {
  const [s, err] = await need(request, env, "admin"); if (err) return err;
  let b = {}; try { b = await request.json() } catch (e) { }
  const sec = await kvJson(env, "sec", {});
  for (const c of CAMPOS) {
    if (b[c] === null) delete sec[c];
    else if (typeof b[c] === "string" && b[c].trim()) sec[c] = b[c].trim().slice(0, 500);
  }
  await env.ESTOQUE.put("sec", JSON.stringify(sec));
  return J({ ok: true });
}
