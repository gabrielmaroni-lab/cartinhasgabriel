// Calcula o frete na SuperFrete. O token fica na variável SUPERFRETE_TOKEN do Netlify.
const ORIGEM = "69033120"; // CNT Computadores
const PACOTE = { height: 2, width: 11, length: 16, weight: 0.1 }; // envelope pequeno
exports.handler = async (event) => {
  const h = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
  const cep = String((event.queryStringParameters || {}).cep || "").replace(/\D/g, "");
  if (cep.length !== 8) return { statusCode: 400, headers: h, body: JSON.stringify({ erro: "CEP inválido" }) };
  const token = process.env.SUPERFRETE_TOKEN;
  if (!token) return { statusCode: 500, headers: h, body: JSON.stringify({ erro: "Token não configurado" }) };
  try {
    const r = await fetch("https://api.superfrete.com/api/v0/calculator", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", Accept: "application/json", "User-Agent": "CartasDoGabriel/1.0" },
      body: JSON.stringify({ from: { postal_code: ORIGEM }, to: { postal_code: cep }, services: "1,2,17",
        options: { own_hand: false, receipt: false, insurance_value: 0, use_insurance_value: false }, package: PACOTE })
    });
    const txt = await r.text(); let d; try { d = JSON.parse(txt) } catch (e) { d = null }
    if (!r.ok || !Array.isArray(d)) return { statusCode: 502, headers: h, body: JSON.stringify({ erro: "SuperFrete não respondeu", status: r.status, detalhe: txt.slice(0, 300) }) };
    const op = d.filter(s => !s.error && !s.has_error && s.price).map(s => ({ nome: s.name, preco: Number(s.price), prazo: s.delivery_time })).sort((a, b) => a.preco - b.preco);
    return { statusCode: 200, headers: h, body: JSON.stringify({ opcoes: op }) };
  } catch (e) {
    return { statusCode: 502, headers: h, body: JSON.stringify({ erro: "Falha ao consultar", detalhe: String(e).slice(0, 200) }) };
  }
};
