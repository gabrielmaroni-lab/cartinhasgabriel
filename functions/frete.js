// Cloudflare Pages Function: /frete?cep=00000000
// O token fica na variável SUPERFRETE_TOKEN do projeto no Cloudflare.
const ORIGEM = "69033120"; // CNT Computadores
const PACOTE = { height: 2, width: 11, length: 16, weight: 0.1 }; // envelope pequeno
export async function onRequest({ request, env }) {
  const h = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
  const out = (s, o) => new Response(JSON.stringify(o), { status: s, headers: h });
  const cep = (new URL(request.url).searchParams.get("cep") || "").replace(/\D/g, "");
  if (cep.length !== 8) return out(400, { erro: "CEP inválido" });
  if (!env.SUPERFRETE_TOKEN) return out(500, { erro: "Token não configurado" });
  try {
    const r = await fetch("https://api.superfrete.com/api/v0/calculator", {
      method: "POST",
      headers: { Authorization: "Bearer " + env.SUPERFRETE_TOKEN, "Content-Type": "application/json", Accept: "application/json", "User-Agent": "CartasDoGabriel/1.0" },
      body: JSON.stringify({ from: { postal_code: ORIGEM }, to: { postal_code: cep }, services: "1,2,17",
        options: { own_hand: false, receipt: false, insurance_value: 0, use_insurance_value: false }, package: PACOTE })
    });
    const txt = await r.text(); let d; try { d = JSON.parse(txt) } catch (e) { d = null }
    if (!r.ok || !Array.isArray(d)) return out(502, { erro: "SuperFrete não respondeu", status: r.status, detalhe: txt.slice(0, 300) });
    const op = d.filter(s => !s.error && !s.has_error && s.price).map(s => ({ nome: s.name, preco: Number(s.price), prazo: s.delivery_time })).sort((a, b) => a.preco - b.preco);
    return out(200, { opcoes: op });
  } catch (e) { return out(502, { erro: "Falha ao consultar", detalhe: String(e).slice(0, 200) }) }
}
