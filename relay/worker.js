export class Room{
 constructor(ctx,env){this.ctx=ctx;this.env=env}
 async fetch(req){
  if(req.headers.get('Upgrade')==='websocket'){
   const [c,s]=Object.values(new WebSocketPair());this.ctx.acceptWebSocket(s);
   const st=await this.ctx.storage.get('state');if(st)s.send(st);
   return new Response(null,{status:101,webSocket:c});}
  if(req.method==='POST'){const b=await req.text();if(b.length>20000)return new Response('big',{status:413});
   await this.ctx.storage.put('state',b);
   for(const w of this.ctx.getWebSockets()){try{w.send(b)}catch(e){}}
   return new Response('ok');}
  return new Response((await this.ctx.storage.get('state'))||'{}',{headers:{'content-type':'application/json'}});}
 webSocketMessage(){}
 webSocketClose(ws){try{ws.close()}catch(e){}}}
export default{async fetch(req,env){
 const u=new URL(req.url),cors={'access-control-allow-origin':env.ALLOWED_ORIGIN||'*','access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,POST,OPTIONS'};
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 const ok=!!env.HOST_TOKEN&&req.headers.get('authorization')==='Bearer '+env.HOST_TOKEN;
 const m=u.pathname.match(/^\/room\/([\w-]{1,40})\/(state|ws)$/);
 if(m){if(req.method==='POST'&&!ok)return new Response('no',{status:401,headers:cors});
  const r=await env.ROOM.get(env.ROOM.idFromName(m[1])).fetch(req);
  if(r.status===101)return r;
  const h=new Headers(r.headers);for(const k in cors)h.set(k,cors[k]);
  return new Response(r.body,{status:r.status,headers:h});}
 if(u.pathname==='/assist'&&req.method==='POST'){
  if(!ok)return new Response('no',{status:401,headers:cors});
  let b;try{b=await req.json()}catch(e){return new Response('bad',{status:400,headers:cors})}
  if(!Array.isArray(b.messages)||JSON.stringify(b.messages).length>12000)return new Response('bad',{status:400,headers:cors});
  const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':env.ANTHROPIC_KEY||'','anthropic-version':'2023-06-01','content-type':'application/json'},body:JSON.stringify({model:env.MODEL||'claude-sonnet-5-5',max_tokens:700,messages:b.messages})});
  if(!r.ok)return new Response('upstream '+r.status,{status:502,headers:cors});
  const j=await r.json();
  return new Response(JSON.stringify({text:(j.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('')}),{headers:{...cors,'content-type':'application/json'}});}
 return new Response('GoodMaster relay',{headers:cors});}};
