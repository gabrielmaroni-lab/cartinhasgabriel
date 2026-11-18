import { J, need, saveItems } from "../../_lib/core.js";
export async function onRequestPut({ request, env }) {
  const [s, err] = await need(request, env); if (err) return err;
  let b; try { b = await request.json() } catch (e) { return J({ erro: "Dados inválidos." }, 400) }
  if (b.items !== undefined) {
    if (!Array.isArray(b.items)) return J({ erro: "Lista de cartas inválida." }, 400);
    for (const i of b.items) if (typeof i.n !== "string" || !i.n.trim() || typeof i.p !== "number" || !(i.p >= 0) || !Number.isInteger(i.q) || i.q < 0) return J({ erro: "Carta com nome, preço ou quantidade inválidos: " + (i.n || i.id) }, 400);
    await saveItems(env, b.items);
  }
  if (b.cfg !== undefined) {
    if (s.papel !== "admin") return J({ erro: "Só administradores mudam as configurações." }, 403);
    if (typeof b.cfg !== "object" || Array.isArray(b.cfg)) return J({ erro: "Configuração inválida." }, 400);
    await env.ESTOQUE.put("cfg", JSON.stringify(b.cfg));
  }
  return J({ ok: true, em: new Date().toISOString() });
}
