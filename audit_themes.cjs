const http = require('http');
const WebSocket = require('ws');
http.get('http://127.0.0.1:18800/json', (res) => {
  let d='';
  res.on('data',c=>d+=c);
  res.on('end',()=>{
    const t=JSON.parse(d).find(x=>x.url&&x.url.includes('localhost:5173'));
    if(!t)process.exit(1);
    const ws=new WebSocket(t.webSocketDebuggerUrl);
    let id=1,p={};
    ws.on('message',(d)=>{try{const m=JSON.parse(d.toString());if(m.id&&p[m.id]){p[m.id](m);delete p[m.id];}}catch(e){}});
    const send=(m,params)=>{const n=id++;ws.send(JSON.stringify({id:n,method:m,params}));return n;};
    const w=(i,to)=>new Promise((r,x)=>{p[i]=r;setTimeout(()=>{if(p[i]){delete p[i];x('timeout')}},to||10000);});
    const ev=async(e)=>{const n=send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true});const r=await w(n,15000);return r.result&&r.result.result?r.result.result.value:null;};

    ws.on('open',async()=>{
      await w(send('Runtime.enable'));
      await new Promise(r=>setTimeout(r,300));
      const selects=await ev('Array.from(document.querySelectorAll("select")).map(function(s){return s.id+"|"+s.name+"|"+s.className+"|options="+s.options.length+" first="+s.options[0].value+" last="+s.options[s.options.length-1].value})');
      console.log(selects);
      ws.close();
    });
    ws.on('close',()=>process.exit(0));
  });
}).on('error',()=>process.exit(1));
setTimeout(()=>process.exit(1),20000);
