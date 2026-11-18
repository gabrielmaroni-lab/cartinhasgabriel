import { J, eq, pbkdf2, kvJson, makeCookie } from "../../_lib/core.js";
export async function onRequestPost({ request, env }) {
  if (!env.ESTOQUE) return J({ erro: "O banco (KV ESTOQUE) não está ligado ao site." }, 503);
  const ip = request.headers.get("CF-Connecting-IP") || "x", rk = "rl:" + ip;
  const n = +(await env.ESTOQUE.get(rk)) || 0; if (n >= 8) return J({ erro: "Muitas tentativas. Aguarde 15 minutos." }, 429);
  let b = {}; try { b = await request.json() } catch (e) { }
  const usuario = String(b.usuario || "admin").trim().toLowerCase().slice(0, 40), senha = String(b.senha || "");
  const users = await kvJson(env, "users", []); const u = users.find(x => x.usuario === usuario);
  let ok = false;
  if (u) ok = await eq(await pbkdf2(senha, u.salt), u.hash);
  else if (usuario === "admin" && env.ADMIN_PASSWORD) ok = await eq(senha, env.ADMIN_PASSWORD);
  if (!ok) { await env.ESTOQUE.put(rk, String(n + 1), { expirationTtl: 900 }); await new Promise(r => setTimeout(r, 1000)); return J({ erro: "Usuário ou senha incorretos." }, 401) }
  return J({ ok: true }, 200, { "Set-Cookie": await makeCookie(env, usuario) });
}
