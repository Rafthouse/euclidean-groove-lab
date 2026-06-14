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
    async function evalJS(expr) { const id = send('Runtime.evaluate', {expression: expr, returnByValue: true, awaitPromise: true}); const res = await waitId(id, 15000); return res.result && res.result.result ? res.result.result.value : null; }
    async function ss(name) { const id = send('Page.captureScreenshot', {format:'png', fromSurface:true}); const res = await waitId(id, 15000); if (res.result && res.result.data) { fs.writeFileSync('screenshots/' + name, Buffer.from(res.result.data, 'base64')); console.log('Saved: ' + name + ' (' + res.result.data.length + ' bytes)'); } }

    ws.on('open', async () => {
      try {
        await waitId(send('Runtime.enable'));
        await new Promise(r => setTimeout(r, 300));
        
        // Set theme
        await evalJS('document.documentElement.setAttribute("data-theme","satisfaction")');
        await new Promise(r => setTimeout(r, 1000));
        
        // 1. Full UI - top
        await evalJS('window.scrollTo(0,0); new Promise(function(r){setTimeout(r,200)})');
        await ss('01-full-ui.png');
        
        // 2. Transport - bottom of page
        await evalJS('window.scrollTo(0,document.body.scrollHeight); new Promise(function(r){setTimeout(r,300)})');
        await ss('02-transport.png');
        
        // 3. Show a track card with pattern bank visible - scroll to first track card
        await evalJS(`
          (function(){
            var cards = document.querySelectorAll('.track-card');
            if(cards.length > 0) {
              cards[0].scrollIntoView({behavior:"instant", block:"start"});
              window.scrollBy(0, -20);
            }
          })();
          new Promise(function(r){setTimeout(r,200)})
        `);
        await ss('03-track-card.png');
        
        console.log('Screenshots complete');
        ws.close();
      } catch(e) { console.error('Error:', e.message); ws.close(); }
    });

    ws.on('error', (e) => console.error('WS err:', e.message));
    ws.on('close', () => process.exit(0));
  });
}).on('error', (e) => { process.exit(1); });
setTimeout(() => process.exit(1), 30000);
