import { J, need, kvJson, pbkdf2, rnd, PAPEIS } from "../../_lib/core.js";
const pub = u => ({ usuario: u.usuario, nome: u.nome, papel: u.papel, criado: u.criado });
export async function onRequestGet({ request, env }) {
  const [s, err] = await need(request, env, "admin"); if (err) return err;
  return J({ usuarios: (await kvJson(env, "users", [])).map(pub), papeis: PAPEIS });
}
export async function onRequestPost({ request, env }) {
  const [s, err] = await need(request, env, "admin"); if (err) return err;
  let b = {}; try { b = await request.json() } catch (e) { }
  const usuario = String(b.usuario || "").trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) return J({ erro: "Usuário: 3 a 30 letras minúsculas, números, ponto, traço." }, 400);
  if (!PAPEIS[b.papel]) return J({ erro: "Escolha o tipo de acesso." }, 400);
  const users = await kvJson(env, "users", []); let u = users.find(x => x.usuario === usuario);
  if (!u && String(b.senha || "").length < 8) return J({ erro: "A senha precisa ter pelo menos 8 caracteres." }, 400);
  if (!u) { u = { usuario, criado: new Date().toISOString() }; users.push(u) }
  u.nome = String(b.nome || usuario).slice(0, 60); u.papel = b.papel;
  if (b.senha) { if (String(b.senha).length < 8) return J({ erro: "A senha precisa ter pelo menos 8 caracteres." }, 400); u.salt = rnd(16); u.hash = await pbkdf2(String(b.senha), u.salt) }
  if (!users.some(x => x.papel === "admin") && !env.ADMIN_PASSWORD) return J({ erro: "Precisa existir pelo menos um administrador." }, 400);
  await env.ESTOQUE.put("users", JSON.stringify(users));
  return J({ ok: true, usuarios: users.map(pub) });
}
export async function onRequestDelete({ request, env }) {
  const [s, err] = await need(request, env, "admin"); if (err) return err;
  const usuario = new URL(request.url).searchParams.get("u");
  if (usuario === s.usuario) return J({ erro: "Você não pode apagar o próprio usuário." }, 400);
  let users = await kvJson(env, "users", []); users = users.filter(x => x.usuario !== usuario);
  if (!users.some(x => x.papel === "admin") && !env.ADMIN_PASSWORD) return J({ erro: "Precisa existir pelo menos um administrador." }, 400);
  await env.ESTOQUE.put("users", JSON.stringify(users));
  return J({ ok: true, usuarios: users.map(pub) });
}
