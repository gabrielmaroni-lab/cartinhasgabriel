import { J, need, listPedidos, listClientes, acharCliente, upsertCliente, normTel, normCpf } from "../../_lib/core.js";
const VENDA = ["pago", "enviado", "entregue"];
// Cadastro de clientes, identificados pelo telefone (WhatsApp) ou pelo CPF.
export async function onRequestGet({ request, env }) {
  const [s, err] = await need(request, env); if (err) return err;
  const u = new URL(request.url), doc = String(u.searchParams.get("doc") || "").replace(/\D/g, ""), id = u.searchParams.get("id");
  const L = await listClientes(env), P = await listPedidos(env);
  const pedsDe = c => P.filter(p => (c.telefone && p.telefone === c.telefone) || (c.cpf && p.cpf === c.cpf));
  const comStats = c => { const ps = pedsDe(c), v = ps.filter(p => VENDA.includes(p.status)); return { ...c, pedidos: ps.length, comprado: Math.round(v.reduce((a, p) => a + p.total, 0) * 100) / 100, ultimo: ps.length ? ps[0].em : "", aberto: ps.filter(p => p.status === "aguardando").length } };
  if (doc || id) {
    const c = id ? L.find(x => x.id === id) : acharCliente(L, normTel(doc), normCpf(doc));
    if (!c) return J({ cliente: null });
    return J({ cliente: comStats(c), historico: pedsDe(c).slice(0, 50).map(p => ({ id: p.id, em: p.em, total: p.total, status: p.status, pagamento: p.pagamento, origem: p.origem })) });
  }
  return J({ clientes: L.map(comStats) });
}
export async function onRequestPost({ request, env }) {
  const [s, err] = await need(request, env); if (err) return err;
  let b = {}; try { b = await request.json() } catch (e) { }
  const tel = normTel(b.telefone), cpf = normCpf(b.cpf);
  if (!tel && !cpf) return J({ erro: "Informe um WhatsApp com DDD ou um CPF válido." }, 400);
  if (!String(b.nome || "").trim()) return J({ erro: "Informe o nome." }, 400);
  const L = await listClientes(env), outro = L.find(x => x.id !== b.id && ((tel && x.telefone === tel) || (cpf && x.cpf === cpf)));
  if (outro) return J({ erro: `Já existe um cadastro com esse ${outro.telefone === tel ? "telefone" : "CPF"}: ${outro.nome || outro.id}.` }, 409);
  return J({ ok: true, cliente: await upsertCliente(env, b, !!b.id) });
}
export async function onRequestDelete({ request, env }) {
  const [s, err] = await need(request, env, "admin"); if (err) return err;
  const id = new URL(request.url).searchParams.get("id");
  const L = (await listClientes(env)).filter(x => x.id !== id);
  await env.ESTOQUE.put("clientes", JSON.stringify(L));
  return J({ ok: true });
}
