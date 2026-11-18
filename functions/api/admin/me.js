import { J, getSession, kvJson } from "../../_lib/core.js";
export async function onRequestGet({ request, env }) {
  const s = await getSession(request, env);
  const temUsuarios = env.ESTOQUE ? (await kvJson(env, "users", [])).length > 0 : false;
  return J({ admin: !!s, usuario: s && s.usuario, nome: s && s.nome, papel: s && s.papel, senha: !!env.ADMIN_PASSWORD || temUsuarios, kv: !!env.ESTOQUE });
}
