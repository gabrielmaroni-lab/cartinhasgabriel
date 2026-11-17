export async function onRequestGet({env,request}){
  const H={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
  let items=null,cfg=null,kvEm=0,fileEm=0;
  try{const r=await env.ASSETS.fetch(new URL("/items_em.txt",request.url));if(r.ok)fileEm=Date.parse((await r.text()).trim())||0}catch(e){}
  if(env.ESTOQUE){cfg=await env.ESTOQUE.get("cfg","json");kvEm=Date.parse(await env.ESTOQUE.get("items_em")||"")||0;if(kvEm>=fileEm)items=await env.ESTOQUE.get("items","json")}
  if(!items){const r=await env.ASSETS.fetch(new URL("/items.json",request.url));items=r.ok?await r.json():[]}
  return new Response(JSON.stringify({items,cfg:cfg||{},kv:!!env.ESTOQUE}),{headers:H});
}
