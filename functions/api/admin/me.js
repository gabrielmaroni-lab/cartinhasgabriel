const enc=new TextEncoder();
const b64u=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
async function hmac(key,data){const k=await crypto.subtle.importKey("raw",enc.encode(key),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return b64u(await crypto.subtle.sign("HMAC",k,enc.encode(data)))}
function getCookie(req,n){const c=req.headers.get("Cookie")||"";const m=c.match(new RegExp("(?:^|; )"+n+"=([^;]+)"));return m?m[1]:null}
async function isAdmin(request,env){if(!env.ADMIN_PASSWORD)return false;const t=getCookie(request,"adm");if(!t)return false;const [exp,sig]=t.split(".");if(!exp||!sig||Date.now()>+exp)return false;return sig===await hmac(env.ADMIN_PASSWORD+"|sessao",exp)}
const J=(o,s=200,h={})=>new Response(JSON.stringify(o),{status:s,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...h}});
export async function onRequestGet({request,env}){return J({admin:await isAdmin(request,env),senha:!!env.ADMIN_PASSWORD,kv:!!env.ESTOQUE})}
