export async function onRequestGet({env,request}){
  const H={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
  let items=null,cfg=null;
  if(env.ESTOQUE){items=await env.ESTOQUE.get("items","json");cfg=await env.ESTOQUE.get("cfg","json")}
  if(!items){const r=await env.ASSETS.fetch(new URL("/items.json",request.url));items=r.ok?await r.json():[]}
  return new Response(JSON.stringify({items,cfg:cfg||{},kv:!!env.ESTOQUE}),{headers:H});
}
