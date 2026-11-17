const enc=new TextEncoder();
const b64u=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
async function hmac(key,data){const k=await crypto.subtle.importKey("raw",enc.encode(key),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return b64u(await crypto.subtle.sign("HMAC",k,enc.encode(data)))}
function getCookie(req,n){const c=req.headers.get("Cookie")||"";const m=c.match(new RegExp("(?:^|; )"+n+"=([^;]+)"));return m?m[1]:null}
async function isAdmin(request,env){if(!env.ADMIN_PASSWORD)return false;const t=getCookie(request,"adm");if(!t)return false;const [exp,sig]=t.split(".");if(!exp||!sig||Date.now()>+exp)return false;return sig===await hmac(env.ADMIN_PASSWORD+"|sessao",exp)}
const J=(o,s=200,h={})=>new Response(JSON.stringify(o),{status:s,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...h}});
export async function onRequestPut({request,env}){
  if(!(await isAdmin(request,env)))return J({erro:"Entre de novo no painel."},401);
  if(!env.ESTOQUE)return J({erro:"O banco (KV ESTOQUE) não está ligado ao site."},503);
  let b;try{b=await request.json()}catch(e){return J({erro:"Dados inválidos."},400)}
  if(b.items!==undefined){
    if(!Array.isArray(b.items))return J({erro:"Lista de cartas inválida."},400);
    for(const i of b.items){if(typeof i.n!=="string"||!i.n.trim()||typeof i.p!=="number"||!(i.p>=0)||!Number.isInteger(i.q)||i.q<0)return J({erro:"Carta com nome, preço ou quantidade inválidos: "+(i.n||i.id)},400)}
    const old=await env.ESTOQUE.get("items");if(old)await env.ESTOQUE.put("items_anterior",old);
    await env.ESTOQUE.put("items",JSON.stringify(b.items));await env.ESTOQUE.put("items_em",new Date().toISOString());
  }
  if(b.cfg!==undefined){if(typeof b.cfg!=="object"||Array.isArray(b.cfg))return J({erro:"Layout inválido."},400);await env.ESTOQUE.put("cfg",JSON.stringify(b.cfg))}
  return J({ok:true,em:new Date().toISOString()});
}
