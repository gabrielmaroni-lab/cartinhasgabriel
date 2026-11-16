const enc=new TextEncoder();
const b64u=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
async function hmac(key,data){const k=await crypto.subtle.importKey("raw",enc.encode(key),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return b64u(await crypto.subtle.sign("HMAC",k,enc.encode(data)))}
function getCookie(req,n){const c=req.headers.get("Cookie")||"";const m=c.match(new RegExp("(?:^|; )"+n+"=([^;]+)"));return m?m[1]:null}
async function isAdmin(request,env){if(!env.ADMIN_PASSWORD)return false;const t=getCookie(request,"adm");if(!t)return false;const [exp,sig]=t.split(".");if(!exp||!sig||Date.now()>+exp)return false;return sig===await hmac(env.ADMIN_PASSWORD+"|sessao",exp)}
const J=(o,s=200,h={})=>new Response(JSON.stringify(o),{status:s,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...h}});
export async function onRequestPost({request,env}){
  if(!env.ADMIN_PASSWORD)return J({erro:"A senha de administrador ainda não foi cadastrada no Cloudflare (variável ADMIN_PASSWORD)."},503);
  const ip=request.headers.get("CF-Connecting-IP")||"x";const rk="rl:"+ip;
  let n=0;if(env.ESTOQUE){n=+(await env.ESTOQUE.get(rk))||0;if(n>=8)return J({erro:"Muitas tentativas. Aguarde 15 minutos."},429)}
  let body={};try{body=await request.json()}catch(e){}
  const ok=(await hmac("cmp",String(body.senha||"")))===(await hmac("cmp",env.ADMIN_PASSWORD));
  if(!ok){if(env.ESTOQUE)await env.ESTOQUE.put(rk,String(n+1),{expirationTtl:900});await new Promise(r=>setTimeout(r,1200));return J({erro:"Senha incorreta."},401)}
  const exp=String(Date.now()+7*864e5);const sig=await hmac(env.ADMIN_PASSWORD+"|sessao",exp);
  return J({ok:true},200,{"Set-Cookie":`adm=${exp}.${sig}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`});
}
