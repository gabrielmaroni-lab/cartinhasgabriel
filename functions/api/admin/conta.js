import { J, need, kvJson, pbkdf2, rnd, eq, getMaster, envTag, makeCookie } from "../../_lib/core.js";
// GET: dados da conta logada. POST: troca usuário/senha.
export async function onRequestGet({ request, env }) {
  const [s, err] = await need(request, env); if (err) return err;
  let podeTrocar = true;
  if (s.master) { const raw = await env.ESTOQUE.get("master", "json"); podeTrocar = !(raw && raw.envTag === await envTag(env)) }
  return J({ usuario: s.usuario, nome: s.nome, papel: s.papel, master: !!s.master, podeTrocar });
}
export async function onRequestPost({ request, env }) {
  const [s, err] = await need(request, env); if (err) return err;
  let b = {}; try { b = await request.json() } catch (e) { }
  const atual = String(b.atual || ""), nova = String(b.nova || ""), novoUsuario = String(b.usuario || s.usuario).trim().toLowerCase();
  if (nova.length < 8) return J({ erro: "A nova senha precisa ter pelo menos 8 caracteres." }, 400);
  if (!/^[a-z0-9._-]{3,30}$/.test(novoUsuario)) return J({ erro: "Usuário: 3 a 30 letras minúsculas, números, ponto ou traço." }, 400);
  const users = await kvJson(env, "users", []);
  if (s.master) {
    const raw = await env.ESTOQUE.get("master", "json"), tag = await envTag(env);
    if (raw && raw.envTag === tag) return J({ erro: "O usuário e a senha do administrador geral já foram trocados uma vez pelo painel. Para trocar de novo, mude a senha ADMIN_PASSWORD no Cloudflare." }, 403);
    if (!await eq(atual, env.ADMIN_PASSWORD)) return J({ erro: "Senha atual incorreta." }, 401);
    if (users.some(x => x.usuario === novoUsuario)) return J({ erro: "Já existe um usuário com esse nome." }, 400);
    const salt = rnd(16);
    await env.ESTOQUE.put("master", JSON.stringify({ usuario: novoUsuario, nome: String(b.nome || "Administrador geral").slice(0, 60), salt, hash: await pbkdf2(nova, salt), envTag: tag, em: new Date().toISOString() }));
    return J({ ok: true, usuario: novoUsuario }, 200, { "Set-Cookie": await makeCookie(env, novoUsuario) });
  }
  const u = users.find(x => x.usuario === s.usuario); if (!u) return J({ erro: "Usuário não encontrado." }, 404);
  if (!await eq(await pbkdf2(atual, u.salt), u.hash)) return J({ erro: "Senha atual incorreta." }, 401);
  if (novoUsuario !== u.usuario) {
    const m = await getMaster(env);
    if (users.some(x => x.usuario === novoUsuario) || (m && m.usuario === novoUsuario) || novoUsuario === "admin") return J({ erro: "Esse nome de usuário já está em uso." }, 400);
    u.usuario = novoUsuario;
  }
  u.salt = rnd(16); u.hash = await pbkdf2(nova, u.salt);
  await env.ESTOQUE.put("users", JSON.stringify(users));
  return J({ ok: true, usuario: u.usuario }, 200, { "Set-Cookie": await makeCookie(env, u.usuario) });
}
