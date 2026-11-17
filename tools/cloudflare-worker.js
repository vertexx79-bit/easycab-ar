// EasyCab — хранилище моделей для коротких AR-ссылок (Cloudflare Worker + KV, привязка KV под именем MODELS).
// POST /up    — тело: модель, упакованная страницей EasyCab ('BZ85'…), до 8 МБ → {"id":"xxxxxxxx"}.
//              Загружать может только владелец: заголовок X-Upload-Key должен совпасть с секретом UPLOAD_KEY.
//              Смотреть по ссылке может любой.
// GET  /m/<id> — модель обратно. Номер = отпечаток содержимого, поэтому повторная загрузка не плодит копий.
const AB='23456789abcdefghjkmnpqrstuvwxyz';
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type, X-Upload-Key'};
export default {
  async fetch(req, env){
    if(req.method==='OPTIONS') return new Response(null,{headers:CORS});
    const url=new URL(req.url);
    if(req.method==='POST'&&url.pathname==='/up'){
      if(!env.UPLOAD_KEY||req.headers.get('X-Upload-Key')!==env.UPLOAD_KEY) return new Response('key',{status:403,headers:CORS});
      const b=new Uint8Array(await req.arrayBuffer());
      if(b.length<16||b.length>8e6||String.fromCharCode(b[0],b[1],b[2],b[3])!=='BZ85') return new Response('bad model',{status:400,headers:CORS});
      const h=new Uint8Array(await crypto.subtle.digest('SHA-256',b));
      const id=Array.from(h.subarray(0,8),x=>AB[x%AB.length]).join('');
      if(!(await env.MODELS.get(id,'stream'))) await env.MODELS.put(id,b);
      return new Response(JSON.stringify({id}),{headers:{...CORS,'Content-Type':'application/json'}});
    }
    const m=url.pathname.match(/^\/m\/([0-9a-z]{6,16})$/);
    if(req.method==='GET'&&m){
      const v=await env.MODELS.get(m[1],'arrayBuffer');
      if(!v) return new Response('not found',{status:404,headers:CORS});
      return new Response(v,{headers:{...CORS,'Content-Type':'application/octet-stream','Cache-Control':'public, max-age=31536000, immutable'}});
    }
    return new Response('EasyCab models: ok',{headers:{...CORS,'Content-Type':'text/plain; charset=utf-8'}});
  }
};
