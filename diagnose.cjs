const http = require('http');
const WebSocket = require('ws');

http.get('http://127.0.0.1:18800/json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const target = JSON.parse(data).find(t => t.url && t.url.includes('localhost:5173'));
    if (!target) process.exit(1);
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    let msgId = 1, pending = {};
    ws.on('message', (data) => {
      try { const m = JSON.parse(data.toString()); if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; } } catch(e) {}
    });
    function send(m, p) { const id = msgId++; ws.send(JSON.stringify({id, method:m, params:p})); return id; }
    function w(id, t) { return new Promise((r,x) => { pending[id]=r; setTimeout(()=>{if(pending[id]){delete pending[id];x('timeout')}},t||10000); }); }
    async function ev(e) { const id = send('Runtime.evaluate', {expression: e, returnByValue: true, awaitPromise: true}); const res = await w(id, 15000); return res.result && res.result.result ? res.result.result.value : null; }

    ws.on('open', async () => {
      await w(send('Runtime.enable'));
      await new Promise(r => setTimeout(r, 300));
      await w(send('Page.reload'));
      await new Promise(r => setTimeout(r, 5000));

      // Test with elements (default)
      let vars = await ev('JSON.stringify({bg:getComputedStyle(document.documentElement).getPropertyValue("--bg").trim(),accent:getComputedStyle(document.documentElement).getPropertyValue("--accent").trim()})');
      let tracks = await ev('document.querySelectorAll(".track-card").length');
      let svgs = await ev('document.querySelectorAll("svg").length');
      let appOk = await ev('!!document.querySelector(".app")');
      let scrolly = await ev('window.scrollY');
      let hdr = await ev('var h=document.querySelector("header");if(!h)return"NO_HDR";var r=h.getBoundingClientRect();r.top+","+r.height');

      console.log('elements: vars=' + vars + ' tracks=' + tracks + ' svgs=' + svgs + ' app=' + appOk + ' scrollY=' + scrolly + ' hdr=' + hdr);
      
      ws.close();
    });
    ws.on('close', () => process.exit(0));
  });
}).on('error', () => process.exit(1));
setTimeout(() => process.exit(1), 30000);
