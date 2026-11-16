export async function onRequestGet({params,env}){
  if(!env.ESTOQUE||!/^[a-z0-9]{6,30}$/.test(params.k))return new Response("não encontrada",{status:404});
  const r=await env.ESTOQUE.getWithMetadata("f:"+params.k,"arrayBuffer");
  if(!r||!r.value)return new Response("não encontrada",{status:404});
  return new Response(r.value,{headers:{"content-type":(r.metadata&&r.metadata.ct)||"image/jpeg","cache-control":"public, max-age=31536000, immutable"}});
}
