import { J, need, loadItems, saveItems } from "../../_lib/core.js";
// Edição rápida de um produto direto da loja (preço, preço cheio e quantidade).
export async function onRequestPut({ request, env }) {
  const [s, err] = await need(request, env); if (err) return err;
  let b = {}; try { b = await request.json() } catch (e) { }
  const items = await loadItems(env, request); const it = items.find(i => String(i.id) === String(b.id));
  if (!it) return J({ erro: "Produto não encontrado." }, 404);
  const p = Math.round(Number(b.p) * 100) / 100, q = Number(b.q), o = b.o === "" || b.o == null ? 0 : Math.round(Number(b.o) * 100) / 100;
  if (!(p >= 0) || !Number.isInteger(q) || q < 0) return J({ erro: "Preço ou quantidade inválidos." }, 400);
  it.p = p; it.q = q; if (o > p) it.o = o; else delete it.o;
  await saveItems(env, items);
  return J({ ok: true, item: { id: it.id, p: it.p, o: it.o || 0, q: it.q } });
}
