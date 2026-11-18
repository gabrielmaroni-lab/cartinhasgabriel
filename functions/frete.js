import { J, cotarFrete } from "./_lib/core.js";
export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const r = await cotarFrete(env, u.searchParams.get("cep"), Number(u.searchParams.get("valor")) || 0);
  return J(r, r.erro ? 400 : 200);
}
