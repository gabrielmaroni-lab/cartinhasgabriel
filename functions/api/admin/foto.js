import { J, need } from "../../_lib/core.js";
export async function onRequestPost({ request, env }) {
  const [s, err] = await need(request, env); if (err) return err;
  const ct = request.headers.get("content-type") || "";
  if (!/^image\/(jpeg|png|webp)$/.test(ct)) return J({ erro: "Envie uma imagem JPG, PNG ou WEBP." }, 400);
  const buf = await request.arrayBuffer(); if (buf.byteLength > 3e6) return J({ erro: "Imagem muito grande (máx. 3 MB)." }, 400);
  const k = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  await env.ESTOQUE.put("f:" + k, buf, { metadata: { ct } });
  return J({ url: "/api/foto/" + k });
}
