const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');

http.get('http://127.0.0.1:18800/json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const targets = JSON.parse(data);
    const target = targets.filter(t => t.type === 'page')[0];
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    let msgId = 1;
    const pending = {};

    ws.on('message', (data) => {
      try {
        const m = JSON.parse(data.toString());
        if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; }
      } catch(e) {}
    });

    function send(method, params) { const id = msgId++; ws.send(JSON.stringify({id, method, params})); return id; }
    function waitId(id, to) { return new Promise((r, x) => { pending[id]=r; setTimeout(()=>{if(pending[id]){delete pending[id]; x('timeout')}},to||10000); }); }
    async function ev(expr) { const id = send('Runtime.evaluate', {expression: expr, returnByValue: true, awaitPromise: true}); const res = await waitId(id, 15000); return res.result && res.result.result ? res.result.result.value : null; }
    async function ss(name) { const id = send('Page.captureScreenshot', {format:'png', fromSurface:true}); const res = await waitId(id, 15000); if (res.result && res.result.data) { const p = 'screenshots/' + name; fs.writeFileSync(p, Buffer.from(res.result.data, 'base64')); console.log(name + ' (' + fs.statSync(p).size + ' bytes)'); } }

    ws.on('open', async () => {
      try {
        await waitId(send('Runtime.enable'));
        await new Promise(r => setTimeout(r, 300));

        await ev('document.documentElement.setAttribute("data-theme","satisfaction")');
        await new Promise(r => setTimeout(r, 1000));

        const ih = parseInt(await ev('window.innerHeight'));

        // 1. Full app - top
        await ev('window.scrollTo(0,0); new Promise(function(r){setTimeout(r,300)})');
        await ss('01-full-application.png');

        // 2. Transport - scroll to bottom section where transport lives
        await ev('window.scrollTo(0,20000); new Promise(function(r){setTimeout(r,300)})');
        await ss('02-transport-section.png');

        // 3. Pattern bank - first third
        await ev('window.scrollTo(0, Math.round(' + ih + ' * 0.6)); new Promise(function(r){setTimeout(r,300)})');
        await ss('03-pattern-bank.png');

        // 4. Track card - middle area
        await ev('window.scrollTo(0, Math.round(' + ih + ' * 1.5)); new Promise(function(r){setTimeout(r,300)})');
        await ss('04-track-card.png');

        // 5. Mixer - find mixer position
        await ev("(function(){var el=document.querySelector('[class*=mixer],[class*=master]');if(el){var r=el.getBoundingClientRect();window.scrollTo(0,window.scrollY+r.top-60);}return!!el;})();new Promise(function(r){setTimeout(r,300)})");
        await ss('05-mixer-section.png');

        console.log('---ALL DONE---');
        ws.close();
      } catch(e) { console.error('Error:', e.message); ws.close(); }
    });

    ws.on('error', (e) => console.error('WS err:', e.message));
    ws.on('close', () => process.exit(0));
  });
}).on('error', (e) => { process.exit(1); });
setTimeout(() => process.exit(1), 30000);
